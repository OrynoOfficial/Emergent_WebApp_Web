import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCheck } from 'lucide-react';

export function AssignModal({ 
  open, 
  onOpenChange, 
  ticket, 
  teamMembers, 
  selectedAssignee, 
  onAssigneeChange, 
  notes, 
  onNotesChange, 
  onAssign 
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white">
        <DialogHeader>
          <DialogTitle>Assign Ticket</DialogTitle>
          <DialogDescription>
            Assign ticket {ticket?.ticket_number} to a team member
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Select Team Member</Label>
            <Select value={selectedAssignee} onValueChange={onAssigneeChange}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="Choose assignee..." /></SelectTrigger>
              <SelectContent className="bg-white">
                {teamMembers.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex items-center gap-2">
                      <span>{m.name}</span>
                      <span className="text-xs text-slate-500">({m.role})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium mb-2 block">Assignment Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Add any notes about this assignment..."
              rows={3}
              className="bg-white"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onAssign} disabled={!selectedAssignee} className="bg-[#082c59]">
            <UserCheck className="w-4 h-4 mr-2" />Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BulkAssignModal({ 
  open, 
  onOpenChange, 
  selectedCount, 
  teamMembers, 
  selectedAssignee, 
  onAssigneeChange, 
  onAssign 
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white">
        <DialogHeader>
          <DialogTitle>Bulk Assign Tickets</DialogTitle>
          <DialogDescription>
            Assign {selectedCount} ticket(s) to a team member
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Select Team Member</Label>
            <Select value={selectedAssignee} onValueChange={onAssigneeChange}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="Choose assignee..." /></SelectTrigger>
              <SelectContent className="bg-white">
                {teamMembers.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex items-center gap-2">
                      <span>{m.name}</span>
                      <span className="text-xs text-slate-500">({m.role})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onAssign} disabled={!selectedAssignee} className="bg-[#082c59]">
            <UserCheck className="w-4 h-4 mr-2" />Assign {selectedCount} Tickets
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
