import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Database, Search, RefreshCw, Trash2,
  Table, FileText, CheckCircle, Clock,
  HardDrive, Activity, Eye, Edit, Plus, X
} from 'lucide-react';
import api from '@/api/client';
import { toast } from 'sonner';

export default function DatabaseManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [collections, setCollections] = useState([]);
  const [stats, setStats] = useState(null);
  const [recentOps, setRecentOps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsTotal, setDocsTotal] = useState(0);
  const [docSearch, setDocSearch] = useState('');
  
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [editJson, setEditJson] = useState('');
  const [createJson, setCreateJson] = useState('{\n  \n}');

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (selectedCollection) {
      loadDocuments(selectedCollection);
    }
  }, [selectedCollection, docSearch]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [statsRes, opsRes] = await Promise.all([
        api.get('/database/stats'),
        api.get('/database/recent-operations')
      ]);
      setStats(statsRes.data);
      setCollections(statsRes.data.collections || []);
      setRecentOps(opsRes.data.operations || []);
    } catch (error) {
      console.error('Failed to load database stats:', error);
      toast.error('Failed to load database statistics');
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async (collectionName) => {
    setDocsLoading(true);
    try {
      const res = await api.get(`/database/collections/${collectionName}`, {
        params: { search: docSearch, limit: 50 }
      });
      setDocuments(res.data.documents || []);
      setDocsTotal(res.data.total || 0);
    } catch (error) {
      console.error('Failed to load documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setDocsLoading(false);
    }
  };

  const handleViewDoc = (doc) => {
    setSelectedDoc(doc);
    setIsViewOpen(true);
  };

  const handleEditDoc = (doc) => {
    setSelectedDoc(doc);
    setEditJson(JSON.stringify(doc, null, 2));
    setIsEditOpen(true);
  };

  const handleDeleteDoc = (doc) => {
    setSelectedDoc(doc);
    setIsDeleteOpen(true);
  };

  const saveEdit = async () => {
    try {
      const data = JSON.parse(editJson);
      await api.put(`/database/collections/${selectedCollection}/${selectedDoc.id}`, { data });
      toast.success('Document updated successfully');
      setIsEditOpen(false);
      loadDocuments(selectedCollection);
      loadStats();
    } catch (error) {
      if (error instanceof SyntaxError) {
        toast.error('Invalid JSON format');
      } else {
        toast.error(error.response?.data?.detail || 'Failed to update document');
      }
    }
  };

  const createDocument = async () => {
    try {
      const data = JSON.parse(createJson);
      await api.post(`/database/collections/${selectedCollection}`, { data });
      toast.success('Document created successfully');
      setIsCreateOpen(false);
      setCreateJson('{\n  \n}');
      loadDocuments(selectedCollection);
      loadStats();
    } catch (error) {
      if (error instanceof SyntaxError) {
        toast.error('Invalid JSON format');
      } else {
        toast.error(error.response?.data?.detail || 'Failed to create document');
      }
    }
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/database/collections/${selectedCollection}/${selectedDoc.id}`);
      toast.success('Document deleted successfully');
      setIsDeleteOpen(false);
      loadDocuments(selectedCollection);
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete document');
    }
  };

  const filteredCollections = collections.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const truncateValue = (value, maxLen = 50) => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'object') {
      const str = JSON.stringify(value);
      return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
    }
    const str = String(value);
    return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]">Database Management</h1>
          <p className="text-gray-600">View and manage database collections</p>
        </div>
        <Button onClick={loadStats} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Database className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalCollections}</p>
                  <p className="text-sm text-gray-600">Collections</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <FileText className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalDocuments?.toLocaleString()}</p>
                  <p className="text-sm text-gray-600">Documents</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <HardDrive className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalSize}</p>
                  <p className="text-sm text-gray-600">Total Size</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Activity className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{recentOps.length}</p>
                  <p className="text-sm text-gray-600">Recent Ops</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="collections" className="space-y-4">
        <TabsList>
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="operations">Recent Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="collections" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">All Collections</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search collections..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-[#082c59] border-t-transparent rounded-full mx-auto"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Collection</th>
                        <th className="text-left py-3 px-4 font-medium">Documents</th>
                        <th className="text-left py-3 px-4 font-medium">Size</th>
                        <th className="text-left py-3 px-4 font-medium">Indexes</th>
                        <th className="text-left py-3 px-4 font-medium">Last Modified</th>
                        <th className="text-left py-3 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCollections.map((collection) => (
                        <tr key={collection.name} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Table className="w-4 h-4 text-gray-400" />
                              <span className="font-medium">{collection.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline">{collection.documents?.toLocaleString()}</Badge>
                          </td>
                          <td className="py-3 px-4 text-gray-600">{collection.size}</td>
                          <td className="py-3 px-4 text-gray-600">{collection.indexes}</td>
                          <td className="py-3 px-4 text-sm text-gray-500">
                            {formatDate(collection.lastModified)}
                          </td>
                          <td className="py-3 px-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedCollection(collection.name);
                                setDocSearch('');
                              }}
                            >
                              <Eye className="w-4 h-4 mr-1" /> View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <CardTitle className="text-lg">
                    {selectedCollection ? `${selectedCollection} Documents` : 'Select a Collection'}
                  </CardTitle>
                  {selectedCollection && (
                    <Badge variant="outline">{docsTotal} total</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Select value={selectedCollection || ''} onValueChange={setSelectedCollection}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select collection" />
                    </SelectTrigger>
                    <SelectContent className="bg-white max-h-[300px]">
                      {collections.map(c => (
                        <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedCollection && (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          placeholder="Search..."
                          value={docSearch}
                          onChange={(e) => setDocSearch(e.target.value)}
                          className="pl-10 w-48"
                        />
                      </div>
                      <Button onClick={() => setIsCreateOpen(true)} className="bg-[#082c59]">
                        <Plus className="w-4 h-4 mr-1" /> Add
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!selectedCollection ? (
                <div className="text-center py-12 text-gray-500">
                  <Database className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>Select a collection from the dropdown to view documents</p>
                </div>
              ) : docsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-[#082c59] border-t-transparent rounded-full mx-auto"></div>
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>No documents found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left py-2 px-3 font-medium">ID</th>
                        {documents[0] && Object.keys(documents[0]).filter(k => k !== 'id').slice(0, 4).map(key => (
                          <th key={key} className="text-left py-2 px-3 font-medium">{key}</th>
                        ))}
                        <th className="text-left py-2 px-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc) => (
                        <tr key={doc.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-3 font-mono text-xs">{truncateValue(doc.id, 20)}</td>
                          {Object.keys(doc).filter(k => k !== 'id').slice(0, 4).map(key => (
                            <td key={key} className="py-2 px-3">{truncateValue(doc[key])}</td>
                          ))}
                          <td className="py-2 px-3">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleViewDoc(doc)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleEditDoc(doc)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteDoc(doc)} className="text-red-600">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Database Operations</CardTitle>
            </CardHeader>
            <CardContent>
              {recentOps.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No recent operations</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentOps.map((op) => (
                    <div key={op.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          op.type === 'CREATE' || op.type === 'INSERT' ? 'bg-green-100' :
                          op.type === 'UPDATE' ? 'bg-blue-100' :
                          op.type === 'DELETE' ? 'bg-red-100' : 'bg-gray-100'
                        }`}>
                          {op.type === 'CREATE' || op.type === 'INSERT' ? <Plus className="w-4 h-4 text-green-600" /> :
                           op.type === 'UPDATE' ? <Edit className="w-4 h-4 text-blue-600" /> :
                           op.type === 'DELETE' ? <Trash2 className="w-4 h-4 text-red-600" /> :
                           <Activity className="w-4 h-4 text-gray-600" />}
                        </div>
                        <div>
                          <p className="font-medium">{op.type} on {op.collection}</p>
                          <p className="text-sm text-gray-500">{formatDate(op.timestamp)}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        <CheckCircle className="w-3 h-3 mr-1" /> Success
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Document Modal */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="bg-white max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Document Details</DialogTitle>
          </DialogHeader>
          <pre className="bg-gray-50 p-4 rounded-lg overflow-auto text-sm font-mono">
            {selectedDoc ? JSON.stringify(selectedDoc, null, 2) : ''}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>Close</Button>
            <Button onClick={() => { setIsViewOpen(false); handleEditDoc(selectedDoc); }} className="bg-[#082c59]">
              Edit Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Document Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-white max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Label>Document JSON</Label>
            <Textarea
              value={editJson}
              onChange={(e) => setEditJson(e.target.value)}
              className="font-mono text-sm min-h-[400px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} className="bg-[#082c59]">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Document Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-white max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Document in {selectedCollection}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Label>Document JSON</Label>
            <Textarea
              value={createJson}
              onChange={(e) => setCreateJson(e.target.value)}
              placeholder='{"field": "value"}'
              className="font-mono text-sm min-h-[300px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={createDocument} className="bg-[#082c59]">Create Document</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Are you sure you want to delete this document? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
