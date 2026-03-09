import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCheck, CheckCircle, Loader2 } from 'lucide-react';

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
  const [assigning, setAssigning] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleAssign = async () => {
    setAssigning(true);
    try {
      await onAssign();
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setAssigning(false);
        onOpenChange(false);
      }, 4000);
    } catch {
      setAssigning(false);
    }
  };

  // Reset state when modal opens/closes
  const handleOpenChange = (val) => {
    if (!val) { setSuccess(false); setAssigning(false); }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md bg-gradient-to-b from-[#082c59]/[0.03] to-slate-50 border border-slate-200 shadow-2xl rounded-2xl">
        {success ? (
          <div className="flex flex-col items-center justify-center py-10 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-9 h-9 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Ticket Assigned</h3>
            <p className="text-sm text-emerald-600 mt-1 font-medium">Moved to "In Progress"</p>
            <p className="text-xs text-slate-400 mt-3">Closing in a moment...</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Assign Ticket</DialogTitle>
              <DialogDescription>Assign ticket {ticket?.ticket_number} to a team member</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Select Team Member</Label>
                <Select value={selectedAssignee} onValueChange={onAssigneeChange}>
                  <SelectTrigger className="bg-white/70"><SelectValue placeholder="Choose assignee..." /></SelectTrigger>
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
                <Textarea value={notes} onChange={(e) => onNotesChange(e.target.value)} placeholder="Add any notes..." rows={3} className="bg-white/70" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
              <Button onClick={handleAssign} disabled={!selectedAssignee || assigning} className="bg-[#082c59] hover:bg-[#0a3a75] gap-2">
                {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                {assigning ? 'Assigning...' : 'Assign'}
              </Button>
            </DialogFooter>
          </>
        )}
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
  const [assigning, setAssigning] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleAssign = async () => {
    setAssigning(true);
    try {
      await onAssign();
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setAssigning(false);
        onOpenChange(false);
      }, 4000);
    } catch {
      setAssigning(false);
    }
  };

  const handleOpenChange = (val) => {
    if (!val) { setSuccess(false); setAssigning(false); }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md bg-gradient-to-b from-[#082c59]/[0.03] to-slate-50 border border-slate-200 shadow-2xl rounded-2xl">
        {success ? (
          <div className="flex flex-col items-center justify-center py-10 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-9 h-9 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">{selectedCount} Ticket(s) Assigned</h3>
            <p className="text-sm text-emerald-600 mt-1 font-medium">Moved to "In Progress"</p>
            <p className="text-xs text-slate-400 mt-3">Closing in a moment...</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Bulk Assign Tickets</DialogTitle>
              <DialogDescription>Assign {selectedCount} ticket(s) to a team member</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Select Team Member</Label>
                <Select value={selectedAssignee} onValueChange={onAssigneeChange}>
                  <SelectTrigger className="bg-white/70"><SelectValue placeholder="Choose assignee..." /></SelectTrigger>
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
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
              <Button onClick={handleAssign} disabled={!selectedAssignee || assigning} className="bg-[#082c59] hover:bg-[#0a3a75] gap-2">
                {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                {assigning ? 'Assigning...' : `Assign ${selectedCount} Tickets`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
