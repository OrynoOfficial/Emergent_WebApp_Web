import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Database, Search, Download, Upload, RefreshCw, Trash2,
  Table, FileText, AlertTriangle, CheckCircle, Clock,
  HardDrive, Activity, Settings, Eye, Edit, Plus
} from 'lucide-react';

const COLLECTIONS = [
  { name: 'users', documents: 1250, size: '2.4 MB', lastModified: '2025-12-22 14:30', indexes: 3 },
  { name: 'orders', documents: 8450, size: '15.2 MB', lastModified: '2025-12-22 14:28', indexes: 5 },
  { name: 'hotels', documents: 145, size: '0.8 MB', lastModified: '2025-12-20 10:15', indexes: 2 },
  { name: 'rooms', documents: 520, size: '1.2 MB', lastModified: '2025-12-20 10:15', indexes: 2 },
  { name: 'travel_routes', documents: 89, size: '0.3 MB', lastModified: '2025-12-19 16:45', indexes: 3 },
  { name: 'vehicles', documents: 67, size: '0.2 MB', lastModified: '2025-12-18 09:20', indexes: 2 },
  { name: 'restaurants', documents: 78, size: '0.4 MB', lastModified: '2025-12-17 11:30', indexes: 2 },
  { name: 'events', documents: 34, size: '0.2 MB', lastModified: '2025-12-15 14:00', indexes: 2 },
  { name: 'operators', documents: 45, size: '0.3 MB', lastModified: '2025-12-14 10:00', indexes: 2 },
  { name: 'employees', documents: 28, size: '0.1 MB', lastModified: '2025-12-12 15:30', indexes: 2 }
];

const RECENT_OPERATIONS = [
  { id: 1, type: 'INSERT', collection: 'orders', count: 15, timestamp: '2025-12-22 14:28', status: 'success' },
  { id: 2, type: 'UPDATE', collection: 'users', count: 3, timestamp: '2025-12-22 14:25', status: 'success' },
  { id: 3, type: 'DELETE', collection: 'orders', count: 2, timestamp: '2025-12-22 14:20', status: 'success' },
  { id: 4, type: 'BACKUP', collection: 'all', count: null, timestamp: '2025-12-22 12:00', status: 'success' },
  { id: 5, type: 'INDEX', collection: 'orders', count: 1, timestamp: '2025-12-22 10:30', status: 'success' }
];

export default function DatabaseManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [isQueryOpen, setIsQueryOpen] = useState(false);
  const [queryText, setQueryText] = useState('');

  const filteredCollections = COLLECTIONS.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const dbStats = {
    totalSize: '21.1 MB',
    totalDocuments: COLLECTIONS.reduce((sum, c) => sum + c.documents, 0),
    totalCollections: COLLECTIONS.length,
    uptime: '45 days',
    connections: 12,
    avgQueryTime: '2.3ms'
  };

  const getOperationBadge = (type) => {
    const styles = {
      INSERT: 'bg-green-100 text-green-800',
      UPDATE: 'bg-blue-100 text-blue-800',
      DELETE: 'bg-red-100 text-red-800',
      BACKUP: 'bg-purple-100 text-purple-800',
      INDEX: 'bg-yellow-100 text-yellow-800'
    };
    return <Badge className={styles[type] || 'bg-gray-100'}>{type}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]">Database Management</h1>
          <p className="text-gray-600">Monitor and manage database collections</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Upload className="w-4 h-4 mr-2" /> Import</Button>
          <Button variant="outline"><Download className="w-4 h-4 mr-2" /> Backup</Button>
          <Dialog open={isQueryOpen} onOpenChange={setIsQueryOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#082c59]"><FileText className="w-4 h-4 mr-2" /> Run Query</Button>
            </DialogTrigger>
            <DialogContent className="bg-white max-w-2xl">
              <DialogHeader>
                <DialogTitle>Run Database Query</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Collection</Label>
                  <Select>
                    <SelectTrigger className="mt-2"><SelectValue placeholder="Select collection" /></SelectTrigger>
                    <SelectContent className="bg-white">
                      {COLLECTIONS.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Query (JSON)</Label>
                  <textarea
                    className="w-full h-32 mt-2 p-3 border rounded-md font-mono text-sm"
                    placeholder='{"status": "active"}'
                    value={queryText}
                    onChange={(e) => setQueryText(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 bg-[#082c59]">Execute Query</Button>
                  <Button variant="outline" className="flex-1">Explain Query</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card><CardContent className="p-4 text-center">
          <HardDrive className="w-6 h-6 mx-auto text-blue-600 mb-2" />
          <p className="text-2xl font-bold">{dbStats.totalSize}</p>
          <p className="text-xs text-gray-500">Total Size</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <FileText className="w-6 h-6 mx-auto text-green-600 mb-2" />
          <p className="text-2xl font-bold">{dbStats.totalDocuments.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Documents</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Table className="w-6 h-6 mx-auto text-purple-600 mb-2" />
          <p className="text-2xl font-bold">{dbStats.totalCollections}</p>
          <p className="text-xs text-gray-500">Collections</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Clock className="w-6 h-6 mx-auto text-orange-600 mb-2" />
          <p className="text-2xl font-bold">{dbStats.uptime}</p>
          <p className="text-xs text-gray-500">Uptime</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Activity className="w-6 h-6 mx-auto text-red-600 mb-2" />
          <p className="text-2xl font-bold">{dbStats.connections}</p>
          <p className="text-xs text-gray-500">Connections</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <RefreshCw className="w-6 h-6 mx-auto text-teal-600 mb-2" />
          <p className="text-2xl font-bold">{dbStats.avgQueryTime}</p>
          <p className="text-xs text-gray-500">Avg Query Time</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="collections" className="w-full">
        <TabsList>
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="operations">Recent Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="collections" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Database Collections</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input placeholder="Search collections..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-4 font-medium">Collection</th>
                      <th className="text-left p-4 font-medium">Documents</th>
                      <th className="text-left p-4 font-medium">Size</th>
                      <th className="text-left p-4 font-medium">Indexes</th>
                      <th className="text-left p-4 font-medium">Last Modified</th>
                      <th className="text-left p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCollections.map(collection => (
                      <tr key={collection.name} className="border-b hover:bg-slate-50">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <Database className="w-5 h-5 text-[#082c59]" />
                            <span className="font-mono font-medium">{collection.name}</span>
                          </div>
                        </td>
                        <td className="p-4">{collection.documents.toLocaleString()}</td>
                        <td className="p-4">{collection.size}</td>
                        <td className="p-4">{collection.indexes}</td>
                        <td className="p-4 text-sm text-gray-500">{collection.lastModified}</td>
                        <td className="p-4">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm"><Eye className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm"><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm"><Settings className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm" className="text-red-600"><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operations" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Database Operations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {RECENT_OPERATIONS.map(op => (
                  <div key={op.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      {getOperationBadge(op.type)}
                      <div>
                        <p className="font-medium">
                          <span className="font-mono">{op.collection}</span>
                          {op.count !== null && <span className="text-gray-500 ml-2">({op.count} documents)</span>}
                        </p>
                        <p className="text-sm text-gray-500">{op.timestamp}</p>
                      </div>
                    </div>
                    <Badge className={op.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {op.status === 'success' ? <CheckCircle className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
                      {op.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
