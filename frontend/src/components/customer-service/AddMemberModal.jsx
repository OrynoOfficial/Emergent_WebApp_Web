import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserPlus, Search, Users, Plus } from 'lucide-react';

export function AddMemberModal({ 
  open, 
  onOpenChange, 
  availableMembers, 
  searchTerm, 
  onSearchChange, 
  onAddMember 
}) {
  const filteredMembers = availableMembers.filter(m => 
    !searchTerm || 
    m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#082c59]" />Add Team Member
          </DialogTitle>
          <DialogDescription>
            Select from available employees and users to add to your support team
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Search Available Members */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search available members..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-white"
            />
          </div>

          {/* Available Members List */}
          <div className="border rounded-lg max-h-[300px] overflow-y-auto">
            {availableMembers.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm">No available members to add</p>
                <p className="text-xs text-slate-400 mt-1">All eligible users are already in the team</p>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Search className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm">No members match your search</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredMembers.map((member, i) => (
                  <div 
                    key={i} 
                    className="flex items-center gap-4 p-3 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => onAddMember(member)}
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-slate-200 text-slate-700">
                        {member.name?.split(' ').map(n => n[0]).join('').substring(0, 2) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 text-sm">{member.name}</p>
                      <p className="text-xs text-slate-500">{member.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]">{member.role}</Badge>
                        <Badge variant="outline" className="text-[10px]">{member.department}</Badge>
                      </div>
                    </div>
                    <Button size="sm" className="bg-[#082c59] h-8">
                      <Plus className="w-3 h-3 mr-1" />Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
