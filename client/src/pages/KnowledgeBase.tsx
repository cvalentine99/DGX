import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Database,
  FileText,
  Search,
  Upload,
  Trash2,
  RefreshCw,
  BookOpen,
  Code,
  Layers,
  Brain,
  Server,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";

type DocumentCategory = "training_data" | "user_guide" | "api_docs" | "playbook";

export default function KnowledgeBase() {
  const [searchQuery, setSearchQuery] = useState("");
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocContent, setNewDocContent] = useState("");
  const [newDocCategory, setNewDocCategory] = useState<DocumentCategory>("user_guide");
  const [isUploading, setIsUploading] = useState(false);

  // Queries
  const { data: stats, refetch: refetchStats } = trpc.rag.getStats.useQuery();
  const { data: documents, refetch: refetchDocs } = trpc.rag.listDocuments.useQuery({});
  const { data: searchResults, refetch: refetchSearch } = trpc.rag.search.useQuery(
    { query: searchQuery, topK: 10 },
    { enabled: searchQuery.length > 2 }
  );
  const { data: vllmHealth } = trpc.vllm.healthCheck.useQuery();

  // Mutations
  const addDocMutation = trpc.rag.addDocument.useMutation({
    onSuccess: () => {
      toast.success("Document added successfully");
      setNewDocTitle("");
      setNewDocContent("");
      refetchDocs();
      refetchStats();
    },
    onError: (error) => {
      toast.error(`Failed to add document: ${error.message}`);
    },
  });

  const deleteDocMutation = trpc.rag.deleteDocument.useMutation({
    onSuccess: () => {
      toast.success("Document deleted");
      refetchDocs();
      refetchStats();
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const reloadMutation = trpc.rag.reloadDocuments.useMutation({
    onSuccess: (data) => {
      toast.success(`Reloaded ${data.documentsLoaded} documents`);
      refetchDocs();
      refetchStats();
    },
  });

  const handleAddDocument = async () => {
    if (!newDocTitle || !newDocContent) {
      toast.error("Please provide title and content");
      return;
    }

    setIsUploading(true);
    try {
      await addDocMutation.mutateAsync({
        title: newDocTitle,
        content: newDocContent,
        category: newDocCategory,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "training_data":
        return <Brain className="h-4 w-4" />;
      case "user_guide":
        return <BookOpen className="h-4 w-4" />;
      case "api_docs":
        return <Code className="h-4 w-4" />;
      case "playbook":
        return <Layers className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "training_data":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "user_guide":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "api_docs":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "playbook":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-3">
            <Database className="h-7 w-7 text-[#76b900]" />
            Knowledge Base
          </h1>
          <p className="text-muted-foreground mt-1">
            RAG document store for training data, guides, and API documentation
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">vLLM:</span>
            {vllmHealth?.status === "connected" ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => reloadMutation.mutate()}
            disabled={reloadMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${reloadMutation.isPending ? "animate-spin" : ""}`} />
            Reload
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Documents</p>
                <p className="text-2xl font-bold text-foreground">{stats?.totalDocuments || 0}</p>
              </div>
              <FileText className="h-8 w-8 text-[#76b900]/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Chunks</p>
                <p className="text-2xl font-bold text-foreground">{stats?.totalChunks || 0}</p>
              </div>
              <Layers className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">User Guides</p>
                <p className="text-2xl font-bold text-foreground">{stats?.byCategory?.user_guide || 0}</p>
              </div>
              <BookOpen className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">API Docs</p>
                <p className="text-2xl font-bold text-foreground">{stats?.byCategory?.api_docs || 0}</p>
              </div>
              <Code className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Playbooks</p>
                <p className="text-2xl font-bold text-foreground">{stats?.byCategory?.playbook || 0}</p>
              </div>
              <Layers className="h-8 w-8 text-orange-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="documents" className="data-[state=active]:bg-[#76b900]/20 data-[state=active]:text-[#76b900]">
            <FileText className="h-4 w-4 mr-2" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="search" className="data-[state=active]:bg-[#76b900]/20 data-[state=active]:text-[#76b900]">
            <Search className="h-4 w-4 mr-2" />
            Search
          </TabsTrigger>
          <TabsTrigger value="upload" className="data-[state=active]:bg-[#76b900]/20 data-[state=active]:text-[#76b900]">
            <Upload className="h-4 w-4 mr-2" />
            Add Document
          </TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Indexed Documents</CardTitle>
              <CardDescription>Documents available for RAG-augmented inference</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {documents?.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border hover:border-[#76b900]/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {getCategoryIcon(doc.category)}
                        <div>
                          <p className="font-medium text-foreground">{doc.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {doc.chunkCount} chunks • {doc.source}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getCategoryColor(doc.category)}>
                          {doc.category.replace("_", " ")}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                          onClick={() => deleteDocMutation.mutate({ documentId: doc.id })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(!documents || documents.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No documents indexed yet</p>
                      <p className="text-sm">Add documents to enable RAG-augmented inference</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Search Tab */}
        <TabsContent value="search">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Semantic Search</CardTitle>
              <CardDescription>Search the knowledge base using natural language</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-background border-border"
                />
                <Button
                  onClick={() => refetchSearch()}
                  disabled={searchQuery.length < 3}
                  className="bg-[#76b900] hover:bg-[#76b900]/80"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>

              <ScrollArea className="h-[350px]">
                <div className="space-y-3">
                  {searchResults?.results.map((result, index) => (
                    <div
                      key={index}
                      className="p-4 rounded-lg bg-background/50 border border-border"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(result.category)}
                          <span className="font-medium text-foreground">{result.documentTitle}</span>
                        </div>
                        <Badge variant="outline" className="text-[#76b900] border-[#76b900]/30">
                          Score: {(result.score * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {result.content}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Chunk {result.chunkIndex + 1} • {result.source}
                      </p>
                    </div>
                  ))}
                  {searchQuery.length >= 3 && (!searchResults?.results || searchResults.results.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No results found for "{searchQuery}"</p>
                    </div>
                  )}
                  {searchQuery.length < 3 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Enter at least 3 characters to search</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upload Tab */}
        <TabsContent value="upload">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Add Document</CardTitle>
              <CardDescription>Add new documents to the knowledge base for RAG</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Title</label>
                  <Input
                    placeholder="Document title..."
                    value={newDocTitle}
                    onChange={(e) => setNewDocTitle(e.target.value)}
                    className="bg-background border-border"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Category</label>
                  <Select value={newDocCategory} onValueChange={(v) => setNewDocCategory(v as DocumentCategory)}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user_guide">User Guide</SelectItem>
                      <SelectItem value="api_docs">API Documentation</SelectItem>
                      <SelectItem value="training_data">Training Data</SelectItem>
                      <SelectItem value="playbook">Playbook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Content</label>
                <Textarea
                  placeholder="Paste document content here (Markdown supported)..."
                  value={newDocContent}
                  onChange={(e) => setNewDocContent(e.target.value)}
                  className="bg-background border-border min-h-[250px] font-mono text-sm"
                />
              </div>

              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {newDocContent.length} characters • ~{Math.ceil(newDocContent.length / 500)} chunks
                </p>
                <Button
                  onClick={handleAddDocument}
                  disabled={isUploading || !newDocTitle || !newDocContent}
                  className="bg-[#76b900] hover:bg-[#76b900]/80"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Add Document
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
