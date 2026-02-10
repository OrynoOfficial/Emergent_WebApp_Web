import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit2, Trash2, TrendingUp, Loader2, Palette } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/api/client';

const DEFAULT_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#EC4899', '#06B6D4', '#F97316'];

export default function MarketSegmentManagement() {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', color: '#3B82F6' });

  useEffect(() => { fetchSegments(); }, []);

  const fetchSegments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/geography/market-segments');
      setSegments(res.data.market_segments || []);
    } catch { toast.error('Failed to load market segments'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    try {
      if (editing) {
        await api.put(`/geography/market-segments/${editing.id}`, form);
        toast.success('Segment updated');
      } else {
        await api.post('/geography/market-segments', form);
        toast.success('Segment created');
      }
      setShowModal(false);
      setEditing(null);
      setForm({ name: '', description: '', color: '#3B82F6' });
      fetchSegments();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deactivate this market segment?')) return;
    try {
      await api.delete(`/geography/market-segments/${id}`);
      toast.success('Segment deactivated');
      fetchSegments();
    } catch { toast.error('Failed to delete'); }
  };

  const openEdit = (seg) => {
    setEditing(seg);
    setForm({ name: seg.name, description: seg.description || '', color: seg.color || '#3B82F6' });
    setShowModal(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]" data-testid="market-segments-title">Market Segments</h1>
          <p className="text-slate-600">Manage operator classification categories</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ name: '', description: '', color: '#3B82F6' }); setShowModal(true); }} data-testid="add-segment-btn">
          <Plus className="w-4 h-4 mr-2" /> Add Segment
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {segments.map(seg => (
            <Card key={seg.id} className="hover:shadow-md transition-shadow" data-testid={`segment-card-${seg.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: seg.color + '20' }}>
                      <TrendingUp className="w-5 h-5" style={{ color: seg.color }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{seg.name}</h3>
                      <p className="text-sm text-slate-500">{seg.description || 'No description'}</p>
                    </div>
                  </div>
                  <Badge style={{ backgroundColor: seg.color + '20', color: seg.color, border: `1px solid ${seg.color}40` }}>
                    {seg.id}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                  <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: seg.color }} />
                  <span className="text-xs text-slate-500">{seg.color}</span>
                  <div className="flex-1" />
                  <Button variant="ghost" size="sm" onClick={() => openEdit(seg)}><Edit2 className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(seg.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {segments.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500">No market segments. Click "Add Segment" to create one.</div>
          )}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'Create'} Market Segment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Enterprise" data-testid="segment-name-input" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe this segment..." />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex items-center gap-3 mt-1">
                <input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} className="w-10 h-10 rounded cursor-pointer border-0" />
                <Input value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} className="w-28 font-mono text-sm" />
                <div className="flex gap-1">
                  {DEFAULT_COLORS.map(c => (
                    <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))} className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110" style={{ backgroundColor: c, borderColor: form.color === c ? '#082c59' : 'transparent' }} />
                  ))}
                </div>
              </div>
            </div>
            <div>
              <Label>Preview</Label>
              <Badge className="mt-1" style={{ backgroundColor: form.color + '20', color: form.color, border: `1px solid ${form.color}40` }}>
                {form.name || 'Segment'}
              </Badge>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
