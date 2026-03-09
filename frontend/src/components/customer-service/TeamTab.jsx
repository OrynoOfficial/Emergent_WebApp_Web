import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, UserPlus, RefreshCw, Plus, Mail, UserMinus, AlertCircle, Shield } from 'lucide-react';

export function TeamTab({ teamMembers, onAddMember, onRemoveMember, onRefresh }) {
  return (
    <div className="space-y-6">
      {/* Add Team Member Card */}
      <div className="p-5 rounded-xl border-2 border-dashed border-slate-200/60 bg-gradient-to-r from-[#082c59]/[0.03] to-slate-50/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
              <UserPlus className="w-5 h-5 text-[#082c59]" />Add Team Member
            </h3>
            <p className="text-sm text-slate-500 mt-1">Add employees or users to your support team. Only team members can be assigned tickets.</p>
          </div>
          <Button onClick={onAddMember} className="bg-[#082c59] hover:bg-[#0a3a75] gap-2 shadow-md">
            <Plus className="w-4 h-4" />Add Member
          </Button>
        </div>
      </div>

      {/* Current Team Members */}
      <div className="rounded-xl border border-slate-200/50 bg-gradient-to-b from-[#082c59]/[0.03] to-slate-50/50 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200/40 bg-[#082c59]/[0.04]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-slate-800">
                <Users className="w-5 h-5 text-[#082c59]" />Support Team ({teamMembers.length})
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">Team members who can be assigned tickets</p>
            </div>
            <Button variant="outline" size="sm" onClick={onRefresh} className="gap-2 bg-white/60">
              <RefreshCw className="w-4 h-4" />Refresh
            </Button>
          </div>
        </div>
        <div className="p-5">
          {teamMembers.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Users className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <h3 className="font-medium text-lg mb-1">No team members yet</h3>
              <p className="text-sm mb-4">Add employees or admins to handle support tickets</p>
              <Button onClick={onAddMember} className="bg-[#082c59] gap-2">
                <Plus className="w-4 h-4" />Add Your First Team Member
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teamMembers.map((member, i) => (
                <div key={i} className="group flex items-center gap-4 p-4 border border-slate-200/40 rounded-xl hover:shadow-md transition-all bg-white/50 relative shadow-sm">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className="bg-[#082c59] text-white text-lg">
                      {member.name?.split(' ').map(n => n[0]).join('').substring(0, 2) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900">{member.name}</p>
                    <p className="text-sm text-slate-500">{member.role}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs bg-white/60">{member.department}</Badge>
                      <Badge variant="outline" className={`text-xs capitalize ${
                        member.type === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                        member.type === 'employee' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-slate-50 text-slate-700 border-slate-200'
                      }`}>
                        <Shield className="w-3 h-3 mr-1" />{member.type}
                      </Badge>
                      {member.is_auto && (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">Auto-added</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {member.email && (
                      <Button variant="ghost" size="icon" className="h-8 w-8"><Mail className="w-4 h-4" /></Button>
                    )}
                    {!member.is_auto && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onRemoveMember(member)}>
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50/80 to-[#082c59]/[0.04] border border-blue-200/40 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-[#082c59]/10 rounded-lg">
            <AlertCircle className="w-5 h-5 text-[#082c59]" />
          </div>
          <div>
            <h4 className="font-medium text-slate-800">About Team Members</h4>
            <p className="text-sm text-slate-600 mt-1">
              Tickets can only be assigned to members listed here. Admins and Super Admins have full access, while employees can handle tickets assigned to them.
              Members marked as &quot;Auto-added&quot; are detected from system roles and cannot be removed from here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
