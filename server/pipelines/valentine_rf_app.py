import holoscan
from holoscan.core import Application, Operator, OperatorSpec
from holoscan.operators import HolovizOp
import cupy as cp
import cusignal
import numpy as np

# -------------------------------------------------------------------------
# Custom Operator: RF Signal Processor (cuSignal)
# -------------------------------------------------------------------------
class CuSignalProcOp(Operator):
    """
    Performs GPU-accelerated DSP:
    1. Receives raw I/Q samples (Complex64)
    2. Applies Polyphase Filter / FFT
    3. Outputs Spectrogram Tensor for Viz/Inference
    """
    def __init__(self, fragment, *args, **kwargs):
        self.nperseg = 1024
        super().__init__(fragment, *args, **kwargs)

    def setup(self, spec: OperatorSpec):
        spec.input("rx_iq")       # Input: Raw I/Q Data from SDR
        spec.output("spectrogram") # Output: Processed Tensor

    def compute(self, op_input, op_output, context):
        # 1. Zero-Copy Ingest (Grace-Blackwell Shared Memory)
        # We assume input comes as a CuPy array or generic Tensor
        iq_data = op_input.receive("rx_iq")
        
        # Ensure data is on GPU (if coming from RDMA it already is)
        if not isinstance(iq_data, cp.ndarray):
            iq_data = cp.asarray(iq_data)

        # 2. DSP Processing (cuSignal)
        # Create a Blackman window on GPU
        window = cp.blackman(self.nperseg)
        
        # Generate Spectrogram (Returns: freqs, time, magnitude)
        # nperseg=1024, noverlap=512
        f, t, Sxx = cusignal.spectrogram(
            iq_data, 
            fs=20e6,  # 20 MHz Sample Rate
            window=window, 
            nperseg=self.nperseg
        )
        
        # 3. Log Scale for Visualization
        # Add epsilon to avoid log(0)
        Sxx_log = cp.log10(Sxx + 1e-9)
        
        # 4. Format for Holoviz (Height, Width, Channels)
        # Reshape to (Height, Width, 1) for grayscale heatmap
        out_tensor = Sxx_log.reshape(Sxx_log.shape[0], Sxx_log.shape[1], 1)
        
        # Emit
        op_output.emit(out_tensor, "spectrogram")

# -------------------------------------------------------------------------
# Custom Operator: Mock High-Speed SDR Source (For Testing)
# -------------------------------------------------------------------------
class MockSdrSourceOp(Operator):
    def setup(self, spec: OperatorSpec):
        spec.output("tx_iq")

    def compute(self, op_input, op_output, context):
        # Simulate 1ms of IQ data at 20Msps
        # Generate random noise + carrier signal on GPU
        t = cp.arange(20000)
        # Simple FM-like signal
        sig = cp.exp(1j * 2 * cp.pi * 0.1 * t) + (cp.random.randn(20000) + 1j * cp.random.randn(20000)) * 0.1
        op_output.emit(sig.astype(cp.complex64), "tx_iq")

# -------------------------------------------------------------------------
# Application Definition
# -------------------------------------------------------------------------
class ValentineRfApp(Application):
    def compose(self):
        # 1. Source: In production use RoceReceiverOp for 100GbE
        src = MockSdrSourceOp(self, name="sdr_source")

        # 2. Compute: DSP Engine
        dsp = CuSignalProcOp(self, name="cusignal_processor")

        # 3. Viz: Holoviz
        # Configured for 2D Heatmap
        viz = HolovizOp(
            self, 
            name="holoviz",
            tensors=[dict(name="spectrogram", type="color", opacity=1.0)],
            window_title="DGX Spark: RF Spectrum"
        )

        # 4. Pipeline Flow
        self.add_flow(src, dsp, {("tx_iq", "rx_iq")})
        self.add_flow(dsp, viz, {("spectrogram", "receivers")})

if __name__ == "__main__":
    app = ValentineRfApp()
    app.run()
