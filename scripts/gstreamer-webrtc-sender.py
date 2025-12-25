#!/usr/bin/env python3
"""
GStreamer WebRTC Sender for DGX Spark
Captures video from Logitech BRIO camera and streams via WebRTC
with hardware-accelerated H.264 encoding using NVIDIA nvv4l2h264enc.

Usage:
    python3 gstreamer-webrtc-sender.py --device /dev/video0 --resolution 1920x1080 --fps 30

Requirements:
    - GStreamer 1.0 with plugins: good, bad, ugly, libav
    - gst-plugins-bad with webrtcbin
    - NVIDIA GStreamer plugins (nvv4l2h264enc)
    - Python packages: websockets, asyncio, json
"""

import argparse
import asyncio
import json
import logging
import os
import signal
import sys
from typing import Optional

# GStreamer imports
import gi
gi.require_version('Gst', '1.0')
gi.require_version('GstWebRTC', '1.0')
gi.require_version('GstSdp', '1.0')
from gi.repository import Gst, GstWebRTC, GstSdp, GLib

# WebSocket for signaling
try:
    import websockets
except ImportError:
    print("Please install websockets: pip install websockets")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

class WebRTCStreamer:
    """GStreamer WebRTC video streamer with hardware encoding."""
    
    def __init__(
        self,
        device: str = "/dev/video0",
        width: int = 1920,
        height: int = 1080,
        fps: int = 30,
        bitrate: int = 4000000,
        signaling_url: str = "ws://localhost:8765",
        stun_server: str = "stun://stun.l.google.com:19302",
    ):
        self.device = device
        self.width = width
        self.height = height
        self.fps = fps
        self.bitrate = bitrate
        self.signaling_url = signaling_url
        self.stun_server = stun_server
        
        self.pipeline: Optional[Gst.Pipeline] = None
        self.webrtcbin: Optional[Gst.Element] = None
        self.websocket: Optional[websockets.WebSocketClientProtocol] = None
        self.loop: Optional[GLib.MainLoop] = None
        self.session_id: Optional[str] = None
        
        # Initialize GStreamer
        Gst.init(None)
        
    def build_pipeline(self) -> str:
        """Build GStreamer pipeline string with hardware encoding."""
        
        # Check if NVIDIA encoder is available
        nvidia_encoder = "nvv4l2h264enc"
        fallback_encoder = "x264enc"
        
        # Try to use NVIDIA hardware encoder, fallback to software
        encoder_element = f"""
            nvvidconv ! 
            {nvidia_encoder} 
                bitrate={self.bitrate} 
                preset-level=1 
                control-rate=1 
                iframeinterval=30
        """
        
        # Fallback pipeline with software encoding
        fallback_pipeline = f"""
            videoconvert ! 
            {fallback_encoder} 
                bitrate={self.bitrate // 1000} 
                speed-preset=ultrafast 
                tune=zerolatency 
                key-int-max=30
        """
        
        pipeline = f"""
            v4l2src device={self.device} ! 
            video/x-raw,width={self.width},height={self.height},framerate={self.fps}/1 ! 
            videoconvert ! 
            queue max-size-buffers=1 leaky=downstream ! 
            {encoder_element} ! 
            h264parse config-interval=-1 ! 
            rtph264pay config-interval=-1 pt=96 ! 
            queue max-size-buffers=1 leaky=downstream ! 
            application/x-rtp,media=video,encoding-name=H264,payload=96 ! 
            webrtcbin name=sendrecv bundle-policy=max-bundle
        """
        
        # Clean up whitespace
        pipeline = ' '.join(pipeline.split())
        return pipeline
        
    def create_pipeline(self):
        """Create and configure the GStreamer pipeline."""
        pipeline_str = self.build_pipeline()
        logger.info(f"Creating pipeline: {pipeline_str}")
        
        try:
            self.pipeline = Gst.parse_launch(pipeline_str)
        except GLib.Error as e:
            logger.error(f"Failed to create pipeline: {e}")
            # Try fallback with software encoding
            logger.info("Trying fallback pipeline with software encoding...")
            fallback = f"""
                v4l2src device={self.device} ! 
                video/x-raw,width={self.width},height={self.height},framerate={self.fps}/1 ! 
                videoconvert ! 
                x264enc bitrate={self.bitrate // 1000} speed-preset=ultrafast tune=zerolatency ! 
                h264parse ! 
                rtph264pay config-interval=-1 pt=96 ! 
                webrtcbin name=sendrecv bundle-policy=max-bundle
            """
            fallback = ' '.join(fallback.split())
            self.pipeline = Gst.parse_launch(fallback)
        
        # Get webrtcbin element
        self.webrtcbin = self.pipeline.get_by_name("sendrecv")
        if not self.webrtcbin:
            raise RuntimeError("Failed to get webrtcbin element")
        
        # Configure ICE servers
        self._configure_ice_servers()
        
        # Connect signals
        self.webrtcbin.connect("on-negotiation-needed", self._on_negotiation_needed)
        self.webrtcbin.connect("on-ice-candidate", self._on_ice_candidate)
        self.webrtcbin.connect("notify::ice-connection-state", self._on_ice_connection_state)
        self.webrtcbin.connect("notify::connection-state", self._on_connection_state)
        
        # Set up bus message handling
        bus = self.pipeline.get_bus()
        bus.add_signal_watch()
        bus.connect("message", self._on_bus_message)
        
        logger.info("Pipeline created successfully")
        
    def _configure_ice_servers(self):
        """Configure STUN server for local webcam access."""
        if self.stun_server:
            self.webrtcbin.set_property("stun-server", self.stun_server)
            logger.info(f"STUN server configured: {self.stun_server}")
            
    def _on_negotiation_needed(self, element):
        """Called when negotiation is needed - create offer."""
        logger.info("Negotiation needed, creating offer...")
        promise = Gst.Promise.new_with_change_func(self._on_offer_created, element, None)
        element.emit("create-offer", None, promise)
        
    def _on_offer_created(self, promise, element, _):
        """Called when SDP offer is created."""
        promise.wait()
        reply = promise.get_reply()
        offer = reply.get_value("offer")
        
        if not offer:
            logger.error("Failed to create offer")
            return
            
        # Set local description
        promise = Gst.Promise.new()
        element.emit("set-local-description", offer, promise)
        promise.interrupt()
        
        # Send offer to signaling server
        sdp_text = offer.sdp.as_text()
        logger.info("Sending SDP offer to signaling server")
        asyncio.get_event_loop().create_task(
            self._send_signaling_message({
                "type": "offer",
                "sdp": sdp_text,
                "session_id": self.session_id,
            })
        )
        
    def _on_ice_candidate(self, element, mline_index, candidate):
        """Called when a new ICE candidate is discovered."""
        logger.debug(f"ICE candidate: {candidate}")
        asyncio.get_event_loop().create_task(
            self._send_signaling_message({
                "type": "ice-candidate",
                "candidate": candidate,
                "sdpMLineIndex": mline_index,
                "session_id": self.session_id,
            })
        )
        
    def _on_ice_connection_state(self, element, _):
        """Called when ICE connection state changes."""
        state = element.get_property("ice-connection-state")
        state_name = GstWebRTC.WebRTCICEConnectionState(state).value_nick
        logger.info(f"ICE connection state: {state_name}")
        
        if state == GstWebRTC.WebRTCICEConnectionState.FAILED:
            logger.error("ICE connection failed")
        elif state == GstWebRTC.WebRTCICEConnectionState.CONNECTED:
            logger.info("ICE connection established!")
            
    def _on_connection_state(self, element, _):
        """Called when peer connection state changes."""
        state = element.get_property("connection-state")
        state_name = GstWebRTC.WebRTCPeerConnectionState(state).value_nick
        logger.info(f"Peer connection state: {state_name}")
        
    def _on_bus_message(self, bus, message):
        """Handle GStreamer bus messages."""
        t = message.type
        
        if t == Gst.MessageType.ERROR:
            err, debug = message.parse_error()
            logger.error(f"Pipeline error: {err.message}")
            logger.debug(f"Debug info: {debug}")
            self.stop()
        elif t == Gst.MessageType.WARNING:
            warn, debug = message.parse_warning()
            logger.warning(f"Pipeline warning: {warn.message}")
        elif t == Gst.MessageType.EOS:
            logger.info("End of stream")
            self.stop()
        elif t == Gst.MessageType.STATE_CHANGED:
            if message.src == self.pipeline:
                old, new, pending = message.parse_state_changed()
                logger.debug(f"Pipeline state: {old.value_nick} -> {new.value_nick}")
                
    async def _send_signaling_message(self, message: dict):
        """Send message to signaling server via WebSocket."""
        if self.websocket:
            try:
                await self.websocket.send(json.dumps(message))
            except Exception as e:
                logger.error(f"Failed to send signaling message: {e}")
                
    async def _handle_signaling_message(self, message: dict):
        """Handle incoming signaling message."""
        msg_type = message.get("type")
        
        if msg_type == "answer":
            # Set remote description from answer
            sdp = message.get("sdp")
            if sdp:
                logger.info("Received SDP answer")
                res, sdpmsg = GstSdp.SDPMessage.new()
                GstSdp.sdp_message_parse_buffer(bytes(sdp, "utf-8"), sdpmsg)
                answer = GstWebRTC.WebRTCSessionDescription.new(
                    GstWebRTC.WebRTCSDPType.ANSWER, sdpmsg
                )
                promise = Gst.Promise.new()
                self.webrtcbin.emit("set-remote-description", answer, promise)
                promise.interrupt()
                
        elif msg_type == "ice-candidate":
            # Add remote ICE candidate
            candidate = message.get("candidate")
            sdp_mline_index = message.get("sdpMLineIndex", 0)
            if candidate:
                logger.debug(f"Adding remote ICE candidate")
                self.webrtcbin.emit("add-ice-candidate", sdp_mline_index, candidate)
                
        elif msg_type == "session-created":
            self.session_id = message.get("session_id")
            logger.info(f"Session created: {self.session_id}")
            
        elif msg_type == "error":
            logger.error(f"Signaling error: {message.get('message')}")
            
    async def connect_signaling(self):
        """Connect to WebSocket signaling server."""
        logger.info(f"Connecting to signaling server: {self.signaling_url}")
        
        try:
            self.websocket = await websockets.connect(
                self.signaling_url,
                ping_interval=20,
                ping_timeout=10,
            )
            logger.info("Connected to signaling server")
            
            # Send registration message
            await self._send_signaling_message({
                "type": "register",
                "role": "sender",
                "device": self.device,
                "resolution": f"{self.width}x{self.height}",
                "fps": self.fps,
            })
            
            # Start receiving messages
            async for message in self.websocket:
                try:
                    data = json.loads(message)
                    await self._handle_signaling_message(data)
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON message: {message}")
                    
        except Exception as e:
            logger.error(f"Signaling connection error: {e}")
            raise
            
    def start(self):
        """Start the streaming pipeline."""
        logger.info("Starting WebRTC streamer...")
        
        # Create pipeline
        self.create_pipeline()
        
        # Start pipeline
        ret = self.pipeline.set_state(Gst.State.PLAYING)
        if ret == Gst.StateChangeReturn.FAILURE:
            raise RuntimeError("Failed to start pipeline")
            
        logger.info("Pipeline started")
        
    def stop(self):
        """Stop the streaming pipeline."""
        logger.info("Stopping WebRTC streamer...")
        
        if self.pipeline:
            self.pipeline.set_state(Gst.State.NULL)
            self.pipeline = None
            
        if self.websocket:
            asyncio.get_event_loop().create_task(self.websocket.close())
            self.websocket = None
            
        if self.loop:
            self.loop.quit()
            
        logger.info("Streamer stopped")
        
    async def run(self):
        """Main run loop."""
        # Start pipeline
        self.start()
        
        # Connect to signaling server
        try:
            await self.connect_signaling()
        except Exception as e:
            logger.error(f"Failed to connect to signaling: {e}")
            self.stop()
            

def main():
    parser = argparse.ArgumentParser(
        description="GStreamer WebRTC video streamer for DGX Spark"
    )
    parser.add_argument(
        "--device", "-d",
        default="/dev/video0",
        help="Video device path (default: /dev/video0)"
    )
    parser.add_argument(
        "--resolution", "-r",
        default="1920x1080",
        help="Video resolution WIDTHxHEIGHT (default: 1920x1080)"
    )
    parser.add_argument(
        "--fps", "-f",
        type=int,
        default=30,
        help="Frame rate (default: 30)"
    )
    parser.add_argument(
        "--bitrate", "-b",
        type=int,
        default=4000000,
        help="Video bitrate in bps (default: 4000000)"
    )
    parser.add_argument(
        "--signaling-url", "-s",
        default="ws://localhost:8765",
        help="WebSocket signaling server URL"
    )
    parser.add_argument(
        "--stun-server",
        default="stun://stun.l.google.com:19302",
        help="STUN server URL"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose logging"
    )
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
        
    # Parse resolution
    try:
        width, height = map(int, args.resolution.split("x"))
    except ValueError:
        logger.error(f"Invalid resolution format: {args.resolution}")
        sys.exit(1)
        
    # Create streamer
    streamer = WebRTCStreamer(
        device=args.device,
        width=width,
        height=height,
        fps=args.fps,
        bitrate=args.bitrate,
        signaling_url=args.signaling_url,
        stun_server=args.stun_server,
    )
    
    # Handle signals
    def signal_handler(sig, frame):
        logger.info("Received shutdown signal")
        streamer.stop()
        sys.exit(0)
        
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Run streamer
    try:
        asyncio.get_event_loop().run_until_complete(streamer.run())
    except KeyboardInterrupt:
        streamer.stop()
    except Exception as e:
        logger.error(f"Streamer error: {e}")
        streamer.stop()
        sys.exit(1)
        

if __name__ == "__main__":
    main()
