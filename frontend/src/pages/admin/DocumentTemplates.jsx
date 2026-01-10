import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  FileText, Plus, Search, Edit, Trash2, Eye, Copy,
  FileSignature, AlertCircle, CheckCircle, Clock
} from 'lucide-react';
import api from '@/api/client';
import { toast } from 'sonner';

const CATEGORY_INFO = {
  employment_contract: { name: 'Employment Contract', icon: FileSignature, color: 'bg-blue-100 text-blue-800' },
  sick_leave: { name: 'Sick Leave', icon: FileText, color: 'bg-yellow-100 text-yellow-800' },
  termination: { name: 'Termination', icon: AlertCircle, color: 'bg-red-100 text-red-800' },
  promotion: { name: 'Promotion', icon: CheckCircle, color: 'bg-green-100 text-green-800' },
  warning_letter: { name: 'Warning Letter', icon: AlertCircle, color: 'bg-orange-100 text-orange-800' },
  salary_revision: { name: 'Salary Revision', icon: FileText, color: 'bg-purple-100 text-purple-800' },
  probation_completion: { name: 'Probation Completion', icon: CheckCircle, color: 'bg-teal-100 text-teal-800' },
  transfer_letter: { name: 'Transfer Letter', icon: FileText, color: 'bg-indigo-100 text-indigo-800' },
  experience_certificate: { name: 'Experience Certificate', icon: FileSignature, color: 'bg-cyan-100 text-cyan-800' },
  appointment_letter: { name: 'Appointment Letter', icon: FileSignature, color: 'bg-emerald-100 text-emerald-800' },
  other: { name: 'Other', icon: FileText, color: 'bg-gray-100 text-gray-800' }
};

const AVAILABLE_VARIABLES = [
  '{{employee_name}}',
  '{{employee_id}}',
  '{{department}}',
  '{{position}}',
  '{{salary}}',
  '{{start_date}}',
  '{{end_date}}',
  '{{current_date}}',
  '{{manager_name}}',
  '{{company_name}}',
  '{{company_address}}'
];

export default function DocumentTemplates() {
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    content: '',
    variables: []
  });

  useEffect(() => {
    loadTemplates();
    loadCategories();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const res = await api.get('/document-templates/');
      setTemplates(res.data.templates || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await api.get('/document-templates/categories');
      setCategories(res.data.categories || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleCreate = () => {
    setFormData({ name: '', category: '', description: '', content: '', variables: [] });
    setIsCreateOpen(true);
  };

  const handleEdit = (template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      category: template.category,
      description: template.description || '',
      content: template.content,
      variables: template.variables || []
    });
    setIsEditOpen(true);
  };

  const handleView = (template) => {
    setSelectedTemplate(template);
    setIsViewOpen(true);
  };

  const handleDelete = (template) => {
    setSelectedTemplate(template);
    setIsDeleteOpen(true);
  };

  const handleDuplicate = async (template) => {
    try {
      await api.post(`/document-templates/${template.id}/duplicate`);
      toast.success('Template duplicated successfully');
      loadTemplates();
    } catch (error) {
      toast.error('Failed to duplicate template');
    }
  };

  const saveTemplate = async () => {
    if (!formData.name || !formData.category || !formData.content) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (isEditOpen && selectedTemplate) {
        await api.put(`/document-templates/${selectedTemplate.id}`, formData);
        toast.success('Template updated successfully');
      } else {
        await api.post('/document-templates/', formData);
        toast.success('Template created successfully');
      }
      setIsCreateOpen(false);
      setIsEditOpen(false);
      loadTemplates();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save template');
    }
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/document-templates/${selectedTemplate.id}`);
      toast.success('Template deleted successfully');
      setIsDeleteOpen(false);
      loadTemplates();
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  const insertVariable = (variable) => {
    const textarea = document.getElementById('template-content');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = formData.content.substring(0, start) + variable + formData.content.substring(end);
      setFormData({ ...formData, content: newContent });
    } else {
      setFormData({ ...formData, content: formData.content + variable });
    }
  };

  const getCategoryBadge = (category) => {
    const info = CATEGORY_INFO[category] || CATEGORY_INFO.other;
    return <Badge className={info.color}>{info.name}</Badge>;
  };

  const stats = {
    total: templates.length,
    active: templates.filter(t => t.is_active !== false).length,
    byCategory: Object.keys(CATEGORY_INFO).reduce((acc, cat) => {
      acc[cat] = templates.filter(t => t.category === cat).length;
      return acc;
    }, {})
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]">Document Templates</h1>
          <p className="text-gray-600">Manage HR document templates for employees</p>
        </div>
        <Button onClick={handleCreate} className="bg-[#082c59] hover:bg-[#0a3a75]">
          <Plus className="w-4 h-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-gray-600">Total Templates</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-sm text-gray-600">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileSignature className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.byCategory.employment_contract || 0}</p>
                <p className="text-sm text-gray-600">Contracts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.byCategory.termination || 0}</p>
                <p className="text-sm text-gray-600">Termination</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.byCategory.sick_leave || 0}</p>
                <p className="text-sm text-gray-600">Sick Leave</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.byCategory.promotion || 0}</p>
                <p className="text-sm text-gray-600">Promotion</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Templates Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-[#082c59] border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading templates...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">No templates found</h3>
            <p className="text-gray-500 mb-4">Get started by creating your first document template</p>
            <Button onClick={handleCreate} className="bg-[#082c59]">
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <div className="mt-2">
                      {getCategoryBadge(template.category)}
                    </div>
                  </div>
                  {template.is_active === false && (
                    <Badge variant="outline" className="text-gray-500">Inactive</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {template.description || 'No description provided'}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {template.variables?.length || 0} variables
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleView(template)}
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(template)}
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDuplicate(template)}
                      title="Duplicate"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(template)}
                      className="text-red-600 hover:text-red-700"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen || isEditOpen} onOpenChange={(open) => { setIsCreateOpen(false); setIsEditOpen(false); }}>
        <DialogContent className="bg-white max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditOpen ? 'Edit Template' : 'Create New Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Template Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Standard Employment Contract"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Category *</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the template"
                className="mt-1"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Template Content *</Label>
                <div className="flex flex-wrap gap-1">
                  {AVAILABLE_VARIABLES.slice(0, 5).map(v => (
                    <Button
                      key={v}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => insertVariable(v)}
                      className="text-xs h-6"
                    >
                      {v.replace(/\{\{|\}\}/g, '')}
                    </Button>
                  ))}
                  <Select onValueChange={insertVariable}>
                    <SelectTrigger className="h-6 w-20 text-xs">
                      <SelectValue placeholder="More..." />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {AVAILABLE_VARIABLES.slice(5).map(v => (
                        <SelectItem key={v} value={v}>{v.replace(/\{\{|\}\}/g, '')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Textarea
                id="template-content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Enter the template content. Use variables like {{employee_name}} for dynamic content."
                className="mt-1 min-h-[300px] font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); setIsEditOpen(false); }}>
              Cancel
            </Button>
            <Button onClick={saveTemplate} className="bg-[#082c59]">
              {isEditOpen ? 'Update Template' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="bg-white max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              {selectedTemplate && getCategoryBadge(selectedTemplate.category)}
              <span className="text-sm text-gray-500">
                {selectedTemplate?.variables?.length || 0} variables used
              </span>
            </div>
            {selectedTemplate?.description && (
              <p className="text-gray-600">{selectedTemplate.description}</p>
            )}
            <div className="bg-gray-50 p-4 rounded-lg">
              <Label className="text-sm text-gray-500 mb-2 block">Template Content</Label>
              <pre className="whitespace-pre-wrap font-mono text-sm bg-white p-4 rounded border">
                {selectedTemplate?.content}
              </pre>
            </div>
            {selectedTemplate?.variables?.length > 0 && (
              <div>
                <Label className="text-sm text-gray-500 mb-2 block">Variables Used</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedTemplate.variables.map(v => (
                    <Badge key={v} variant="outline">{v}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>Close</Button>
            <Button onClick={() => { setIsViewOpen(false); handleEdit(selectedTemplate); }} className="bg-[#082c59]">
              Edit Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Are you sure you want to delete <strong>{selectedTemplate?.name}</strong>? 
            This action cannot be undone.
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
