import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import * as fs from "fs";
import * as path from "path";

// Simple in-memory document store for RAG
// In production, this would use a vector database like Pinecone, Weaviate, or pgvector
interface Document {
  id: string;
  title: string;
  content: string;
  source: string;
  category: "training_data" | "user_guide" | "api_docs" | "playbook";
  chunks: DocumentChunk[];
  createdAt: Date;
  updatedAt: Date;
}

interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding?: number[]; // Would store actual embeddings in production
  metadata: {
    startIndex: number;
    endIndex: number;
    chunkIndex: number;
  };
}

// In-memory store (would be replaced with database in production)
const documentStore: Map<string, Document> = new Map();
const chunkStore: Map<string, DocumentChunk> = new Map();

// Simple text chunking function
function chunkText(text: string, chunkSize: number = 500, overlap: number = 50): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start >= text.length - overlap) break;
  }
  
  return chunks;
}

// Simple keyword-based similarity (would use embeddings in production)
function calculateSimilarity(query: string, text: string): number {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const textLower = text.toLowerCase();
  
  let matches = 0;
  for (const word of queryWords) {
    if (textLower.includes(word)) {
      matches++;
    }
  }
  
  return queryWords.length > 0 ? matches / queryWords.length : 0;
}

// Load initial documents from docs folder
async function loadInitialDocuments() {
  const docsPath = path.join(process.cwd(), "docs");
  
  if (fs.existsSync(docsPath)) {
    const files = fs.readdirSync(docsPath).filter(f => f.endsWith(".md"));
    
    for (const file of files) {
      const filePath = path.join(docsPath, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const title = file.replace(".md", "").replace(/-/g, " ");
      
      const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const chunks = chunkText(content);
      
      const documentChunks: DocumentChunk[] = chunks.map((chunk, index) => {
        const chunkId = `chunk_${docId}_${index}`;
        const docChunk: DocumentChunk = {
          id: chunkId,
          documentId: docId,
          content: chunk,
          metadata: {
            startIndex: index * 450, // approximate
            endIndex: (index + 1) * 500,
            chunkIndex: index,
          },
        };
        chunkStore.set(chunkId, docChunk);
        return docChunk;
      });
      
      const doc: Document = {
        id: docId,
        title,
        content,
        source: file,
        category: file.includes("guide") ? "user_guide" : "api_docs",
        chunks: documentChunks,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      documentStore.set(docId, doc);
    }
  }
  
  // Load training data from data/training folder
  const trainingPath = path.join(process.cwd(), "data", "training");
  
  if (fs.existsSync(trainingPath)) {
    // Load playbooks JSON
    const playbooksFile = path.join(trainingPath, "nemotron-playbooks.json");
    if (fs.existsSync(playbooksFile)) {
      try {
        const playbooksContent = fs.readFileSync(playbooksFile, "utf-8");
        const playbooks = JSON.parse(playbooksContent);
        
        // Index each playbook as a separate document
        if (playbooks.playbooks && Array.isArray(playbooks.playbooks)) {
          for (const playbook of playbooks.playbooks) {
            const playbookContent = JSON.stringify(playbook, null, 2);
            const docId = `playbook_${playbook.id}_${Date.now()}`;
            const chunks = chunkText(playbookContent, 800, 100);
            
            const documentChunks: DocumentChunk[] = chunks.map((chunk, index) => {
              const chunkId = `chunk_${docId}_${index}`;
              const docChunk: DocumentChunk = {
                id: chunkId,
                documentId: docId,
                content: chunk,
                metadata: {
                  startIndex: index * 700,
                  endIndex: (index + 1) * 800,
                  chunkIndex: index,
                },
              };
              chunkStore.set(chunkId, docChunk);
              return docChunk;
            });
            
            const doc: Document = {
              id: docId,
              title: playbook.name || playbook.id,
              content: playbookContent,
              source: "nemotron-playbooks.json",
              category: "playbook",
              chunks: documentChunks,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            
            documentStore.set(docId, doc);
          }
        }
      } catch (e) {
        console.error("Failed to load playbooks:", e);
      }
    }
    
    // Load training JSONL (sample first 100 examples for RAG)
    const jsonlFile = path.join(trainingPath, "nemotron-training.jsonl");
    if (fs.existsSync(jsonlFile)) {
      try {
        const lines = fs.readFileSync(jsonlFile, "utf-8").split("\n").filter(l => l.trim());
        const sampleSize = Math.min(100, lines.length);
        
        // Create a single document with training examples summary
        const examples = lines.slice(0, sampleSize).map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        }).filter(Boolean);
        
        const summaryContent = examples.map((ex: any) => 
          `Example ${ex.id}:\nPlaybook: ${ex.playbook_name}\nCategory: ${ex.category}\nUser: ${ex.messages?.[1]?.content || "N/A"}\n`
        ).join("\n---\n");
        
        const docId = `training_examples_${Date.now()}`;
        const chunks = chunkText(summaryContent, 600, 50);
        
        const documentChunks: DocumentChunk[] = chunks.map((chunk, index) => {
          const chunkId = `chunk_${docId}_${index}`;
          const docChunk: DocumentChunk = {
            id: chunkId,
            documentId: docId,
            content: chunk,
            metadata: {
              startIndex: index * 550,
              endIndex: (index + 1) * 600,
              chunkIndex: index,
            },
          };
          chunkStore.set(chunkId, docChunk);
          return docChunk;
        });
        
        const doc: Document = {
          id: docId,
          title: "Nemotron Training Examples",
          content: summaryContent,
          source: "nemotron-training.jsonl",
          category: "training_data",
          chunks: documentChunks,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        documentStore.set(docId, doc);
      } catch (e) {
        console.error("Failed to load training JSONL:", e);
      }
    }
  }
}

// Initialize on module load
loadInitialDocuments().catch(console.error);

export const ragRouter = router({
  // Get all documents
  listDocuments: publicProcedure
    .input(z.object({
      category: z.enum(["training_data", "user_guide", "api_docs", "playbook"]).optional(),
    }).optional())
    .query(({ input }) => {
      const docs = Array.from(documentStore.values());
      
      if (input?.category) {
        return docs.filter(d => d.category === input.category).map(d => ({
          id: d.id,
          title: d.title,
          source: d.source,
          category: d.category,
          chunkCount: d.chunks.length,
          createdAt: d.createdAt,
        }));
      }
      
      return docs.map(d => ({
        id: d.id,
        title: d.title,
        source: d.source,
        category: d.category,
        chunkCount: d.chunks.length,
        createdAt: d.createdAt,
      }));
    }),

  // Add a new document
  addDocument: publicProcedure
    .input(z.object({
      title: z.string(),
      content: z.string(),
      source: z.string().optional(),
      category: z.enum(["training_data", "user_guide", "api_docs", "playbook"]),
    }))
    .mutation(({ input }) => {
      const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const chunks = chunkText(input.content);
      
      const documentChunks: DocumentChunk[] = chunks.map((chunk, index) => {
        const chunkId = `chunk_${docId}_${index}`;
        const docChunk: DocumentChunk = {
          id: chunkId,
          documentId: docId,
          content: chunk,
          metadata: {
            startIndex: index * 450,
            endIndex: (index + 1) * 500,
            chunkIndex: index,
          },
        };
        chunkStore.set(chunkId, docChunk);
        return docChunk;
      });
      
      const doc: Document = {
        id: docId,
        title: input.title,
        content: input.content,
        source: input.source || "user_upload",
        category: input.category,
        chunks: documentChunks,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      documentStore.set(docId, doc);
      
      return {
        success: true,
        documentId: docId,
        chunkCount: chunks.length,
      };
    }),

  // Delete a document
  deleteDocument: publicProcedure
    .input(z.object({
      documentId: z.string(),
    }))
    .mutation(({ input }) => {
      const doc = documentStore.get(input.documentId);
      if (!doc) {
        throw new Error("Document not found");
      }
      
      // Remove chunks
      for (const chunk of doc.chunks) {
        chunkStore.delete(chunk.id);
      }
      
      documentStore.delete(input.documentId);
      
      return { success: true };
    }),

  // Search documents using semantic similarity
  search: publicProcedure
    .input(z.object({
      query: z.string(),
      topK: z.number().min(1).max(20).default(5),
      category: z.enum(["training_data", "user_guide", "api_docs", "playbook"]).optional(),
      minScore: z.number().min(0).max(1).default(0.1),
    }))
    .query(({ input }) => {
      const allChunks = Array.from(chunkStore.values());
      
      // Filter by category if specified
      let filteredChunks = allChunks;
      if (input.category) {
        const categoryDocs = Array.from(documentStore.values())
          .filter(d => d.category === input.category)
          .map(d => d.id);
        filteredChunks = allChunks.filter(c => categoryDocs.includes(c.documentId));
      }
      
      // Calculate similarity scores
      const scoredChunks = filteredChunks.map(chunk => ({
        chunk,
        score: calculateSimilarity(input.query, chunk.content),
        document: documentStore.get(chunk.documentId),
      }));
      
      // Sort by score and take top K
      const results = scoredChunks
        .filter(r => r.score >= input.minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, input.topK)
        .map(r => ({
          content: r.chunk.content,
          score: r.score,
          documentId: r.chunk.documentId,
          documentTitle: r.document?.title || "Unknown",
          source: r.document?.source || "Unknown",
          category: r.document?.category || "Unknown",
          chunkIndex: r.chunk.metadata.chunkIndex,
        }));
      
      return {
        query: input.query,
        results,
        totalChunksSearched: filteredChunks.length,
      };
    }),

  // Get context for RAG-augmented generation
  getContext: publicProcedure
    .input(z.object({
      query: z.string(),
      maxTokens: z.number().min(100).max(8000).default(2000),
      categories: z.array(z.enum(["training_data", "user_guide", "api_docs", "playbook"])).optional(),
    }))
    .query(({ input }) => {
      const allChunks = Array.from(chunkStore.values());
      
      // Filter by categories if specified
      let filteredChunks = allChunks;
      if (input.categories && input.categories.length > 0) {
        const categoryDocs = Array.from(documentStore.values())
          .filter(d => input.categories!.includes(d.category))
          .map(d => d.id);
        filteredChunks = allChunks.filter(c => categoryDocs.includes(c.documentId));
      }
      
      // Calculate similarity scores
      const scoredChunks = filteredChunks.map(chunk => ({
        chunk,
        score: calculateSimilarity(input.query, chunk.content),
        document: documentStore.get(chunk.documentId),
      }));
      
      // Sort by score
      const sortedChunks = scoredChunks
        .filter(r => r.score > 0.1)
        .sort((a, b) => b.score - a.score);
      
      // Build context string up to maxTokens (rough estimate: 4 chars per token)
      const maxChars = input.maxTokens * 4;
      let context = "";
      const sources: string[] = [];
      
      for (const item of sortedChunks) {
        if (context.length + item.chunk.content.length > maxChars) break;
        
        context += `\n\n--- From: ${item.document?.title || "Unknown"} ---\n`;
        context += item.chunk.content;
        
        if (item.document && !sources.includes(item.document.source)) {
          sources.push(item.document.source);
        }
      }
      
      return {
        context: context.trim(),
        sources,
        chunksUsed: sources.length,
      };
    }),

  // Get RAG statistics
  getStats: publicProcedure.query(() => {
    const docs = Array.from(documentStore.values());
    const chunks = Array.from(chunkStore.values());
    
    const byCategory = {
      training_data: docs.filter(d => d.category === "training_data").length,
      user_guide: docs.filter(d => d.category === "user_guide").length,
      api_docs: docs.filter(d => d.category === "api_docs").length,
      playbook: docs.filter(d => d.category === "playbook").length,
    };
    
    return {
      totalDocuments: docs.length,
      totalChunks: chunks.length,
      byCategory,
      lastUpdated: docs.length > 0 
        ? Math.max(...docs.map(d => d.updatedAt.getTime()))
        : null,
    };
  }),

  // Reload documents from disk
  reloadDocuments: publicProcedure.mutation(async () => {
    documentStore.clear();
    chunkStore.clear();
    await loadInitialDocuments();
    
    return {
      success: true,
      documentsLoaded: documentStore.size,
    };
  }),
});
