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
      <Card className="shadow-lg border-dashed border-2 border-slate-200 bg-slate-50/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserPlus className="w-5 h-5 text-[#082c59]" />Add Team Member
              </CardTitle>
              <CardDescription className="mt-1">Add employees or users to your support team. Only team members can be assigned tickets.</CardDescription>
            </div>
            <Button onClick={onAddMember} className="bg-[#082c59] gap-2">
              <Plus className="w-4 h-4" />Add Member
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Current Team Members */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#082c59]" />Support Team ({teamMembers.length})
              </CardTitle>
              <CardDescription>Team members who can be assigned tickets</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onRefresh} className="gap-2">
              <RefreshCw className="w-4 h-4" />Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
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
                <div key={i} className="group flex items-center gap-4 p-4 border rounded-xl hover:shadow-md transition-all bg-white relative">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className="bg-[#082c59] text-white text-lg">
                      {member.name?.split(' ').map(n => n[0]).join('').substring(0, 2) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900">{member.name}</p>
                    <p className="text-sm text-slate-500">{member.role}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {member.department}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className={`text-xs capitalize ${
                          member.type === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          member.type === 'employee' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        <Shield className="w-3 h-3 mr-1" />{member.type}
                      </Badge>
                      {member.is_auto && (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                          Auto-added
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {member.email && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.location.href = `mailto:${member.email}`}>
                        <Mail className="w-4 h-4" />
                      </Button>
                    )}
                    {!member.is_auto && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onRemoveMember(member)}
                      >
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="shadow-sm bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h4 className="font-medium text-blue-900">About Team Members</h4>
              <p className="text-sm text-blue-700 mt-1">
                Tickets can only be assigned to members listed here. Add team members based on their roles - 
                Admins and Super Admins have full access, while employees can handle tickets assigned to them.
                Members marked as &quot;Auto-added&quot; are detected from system roles and cannot be removed from here.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
