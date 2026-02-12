import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Upload, X, Loader2 } from 'lucide-react';
import api from '@/api/client';

const MENU_CATEGORIES = [
  { value: 'starters', label: 'Starters' },
  { value: 'mains', label: 'Main Courses' },
  { value: 'desserts', label: 'Desserts' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'specials', label: 'Specials' },
  { value: 'sides', label: 'Sides' }
];

export function MenuItemForm({ form, onChange, isEditing = false }) {
  const updateForm = (field, value) => {
    onChange({ ...form, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Item Name *</Label>
        <Input
          value={form.name || ''}
          onChange={(e) => updateForm('name', e.target.value)}
          placeholder="e.g., Grilled Chicken"
          className="mt-1"
        />
      </div>
      
      <div>
        <Label>Description</Label>
        <Textarea
          value={form.description || ''}
          onChange={(e) => updateForm('description', e.target.value)}
          placeholder="Describe this dish..."
          rows={2}
          className="mt-1"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Category *</Label>
          <Select value={form.category || ''} onValueChange={(v) => updateForm('category', v)}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {MENU_CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label>Price (FCFA) *</Label>
          <Input
            type="number"
            value={form.price || ''}
            onChange={(e) => updateForm('price', e.target.value)}
            placeholder="5000"
            className="mt-1"
          />
        </div>
      </div>
      
      <div>
        <Label>Image URL</Label>
        <Input
          value={form.image || ''}
          onChange={(e) => updateForm('image', e.target.value)}
          placeholder="https://example.com/dish.jpg"
          className="mt-1"
        />
      </div>
      
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
        <div>
          <Label className="cursor-pointer">Available</Label>
          <p className="text-sm text-slate-500">Is this item currently available?</p>
        </div>
        <Switch
          checked={form.is_available !== false}
          onCheckedChange={(checked) => updateForm('is_available', checked)}
        />
      </div>
      
      <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
        <div>
          <Label className="cursor-pointer">Popular Item</Label>
          <p className="text-sm text-slate-500">Mark as a popular/featured item</p>
        </div>
        <Switch
          checked={form.popular === true}
          onCheckedChange={(checked) => updateForm('popular', checked)}
        />
      </div>
    </div>
  );
}

export default MenuItemForm;
