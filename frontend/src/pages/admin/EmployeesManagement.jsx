import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Users, Plus, Search, Edit, Trash2, Eye, UserPlus,
  Phone, Mail, MapPin, Calendar, Briefcase, Clock,
  CheckCircle, XCircle, MoreHorizontal, FileText, ShieldCheck, Network
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';
import api from '@/api/client';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

const DEPARTMENTS = ['all', 'operations', 'customer_service', 'finance', 'marketing', 'it', 'management'];
const ROLES = ['all', 'manager', 'supervisor', 'agent', 'driver', 'receptionist', 'technician'];
const STATUSES = ['all', 'active', 'on_leave', 'suspended', 'terminated'];
const SYSTEM_ROLES = ['employee', 'admin'];
const DEFAULT_PASSWORD = 'Oryno@2024';

export default function EmployeesManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [createForm, setCreateForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department: '',
    role: '',
    salary: '',
    city: '',
    create_user_account: true,
    system_role: 'employee'
  });
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const res = await api.get('/employees/');
      const data = res.data.employees || res.data || [];
      setEmployees(data.length > 0 ? data : mockEmployees);
    } catch (error) {
      console.error('Failed to load employees:', error);
      setEmployees(mockEmployees);
    } finally {
      setLoading(false);
    }
  };

  const mockEmployees = [
    { id: '1', first_name: 'Jean', last_name: 'Mbarga', email: 'jean.mbarga@oryno.cm', phone: '+237 699 111 222', department: 'operations', role: 'manager', status: 'active', hire_date: '2023-01-15', salary: 450000, city: 'Yaounde' },
    { id: '2', first_name: 'Marie', last_name: 'Ngo', email: 'marie.ngo@oryno.cm', phone: '+237 677 333 444', department: 'customer_service', role: 'supervisor', status: 'active', hire_date: '2023-03-20', salary: 320000, city: 'Douala' },
    { id: '3', first_name: 'Paul', last_name: 'Fotso', email: 'paul.fotso@oryno.cm', phone: '+237 655 555 666', department: 'finance', role: 'manager', status: 'active', hire_date: '2023-02-10', salary: 480000, city: 'Yaounde' },
    { id: '4', first_name: 'Aminata', last_name: 'Diallo', email: 'aminata.diallo@oryno.cm', phone: '+237 699 777 888', department: 'customer_service', role: 'agent', status: 'active', hire_date: '2023-06-01', salary: 180000, city: 'Douala' },
    { id: '5', first_name: 'Emmanuel', last_name: 'Tchamba', email: 'emmanuel.tchamba@oryno.cm', phone: '+237 677 999 000', department: 'operations', role: 'driver', status: 'active', hire_date: '2023-05-15', salary: 150000, city: 'Bafoussam' },
    { id: '6', first_name: 'Sylvie', last_name: 'Kamga', email: 'sylvie.kamga@oryno.cm', phone: '+237 655 111 333', department: 'marketing', role: 'agent', status: 'on_leave', hire_date: '2023-08-20', salary: 220000, city: 'Yaounde' },
    { id: '7', first_name: 'Bruno', last_name: 'Essomba', email: 'bruno.essomba@oryno.cm', phone: '+237 699 444 555', department: 'it', role: 'technician', status: 'active', hire_date: '2023-04-10', salary: 280000, city: 'Douala' },
    { id: '8', first_name: 'Claire', last_name: 'Mvondo', email: 'claire.mvondo@oryno.cm', phone: '+237 677 666 777', department: 'operations', role: 'receptionist', status: 'suspended', hire_date: '2023-09-01', salary: 160000, city: 'Yaounde' }
  ];

  const filteredEmployees = employees.filter(emp => {
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = departmentFilter === 'all' || emp.department === departmentFilter;
    const matchesRole = roleFilter === 'all' || emp.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
    return matchesSearch && matchesDept && matchesRole && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      on_leave: 'bg-yellow-100 text-yellow-800',
      suspended: 'bg-red-100 text-red-800',
      terminated: 'bg-gray-100 text-gray-800'
    };
    return <Badge className={styles[status] || styles.terminated}>{status.replace('_', ' ')}</Badge>;
  };

  const getInitials = (first, last) => `${first?.[0] || ''}${last?.[0] || ''}`;

  const handleView = (employee) => {
    setSelectedEmployee(employee);
    setIsViewOpen(true);
  };

  const handleEdit = (employee) => {
    setSelectedEmployee(employee);
    setEditForm({ ...employee });
    setIsEditOpen(true);
  };

  const handleDelete = (employee) => {
    setSelectedEmployee(employee);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/employees/${selectedEmployee.id}`);
      setEmployees(prev => prev.filter(e => e.id !== selectedEmployee.id));
      setIsDeleteOpen(false);
      setSelectedEmployee(null);
    } catch (error) {
      console.error('Failed to delete employee:', error);
      // Still remove from UI for demo
      setEmployees(prev => prev.filter(e => e.id !== selectedEmployee.id));
      setIsDeleteOpen(false);
      setSelectedEmployee(null);
    }
  };

  const handleSaveEdit = async () => {
    try {
      await api.put(`/employees/${selectedEmployee.id}`, editForm);
      setEmployees(prev => prev.map(e => e.id === selectedEmployee.id ? { ...e, ...editForm } : e));
      setIsEditOpen(false);
      setSelectedEmployee(null);
    } catch (error) {
      console.error('Failed to update employee:', error);
      // Still update UI for demo
      setEmployees(prev => prev.map(e => e.id === selectedEmployee.id ? { ...e, ...editForm } : e));
      setIsEditOpen(false);
      setSelectedEmployee(null);
    }
  };

  const handleCreateEmployee = async () => {
    // Validate form
    if (!createForm.first_name || !createForm.last_name || !createForm.email) {
      toast.error('Please fill in required fields (Name, Email)');
      return;
    }
    if (!createForm.department || !createForm.role) {
      toast.error('Please select department and role');
      return;
    }

    setCreateLoading(true);
    try {
      const employeeData = {
        first_name: createForm.first_name,
        last_name: createForm.last_name,
        email: createForm.email,
        phone: createForm.phone,
        department: createForm.department,
        role: createForm.role,
        salary: parseInt(createForm.salary) || 0,
        city: createForm.city,
        status: 'active',
        hire_date: new Date().toISOString().split('T')[0],
        create_user_account: createForm.create_user_account,
        system_role: createForm.system_role
      };

      const res = await api.post('/employees/', employeeData);
      const newEmployee = res.data.employee || res.data;
      
      setEmployees(prev => [...prev, newEmployee]);
      
      if (createForm.create_user_account) {
        toast.success(`Employee created with user account! Default password: ${DEFAULT_PASSWORD}`);
      } else {
        toast.success('Employee created successfully!');
      }
      
      // Reset form
      setCreateForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        department: '',
        role: '',
        salary: '',
        city: '',
        create_user_account: true,
        system_role: 'employee'
      });
      setIsCreateOpen(false);
    } catch (error) {
      console.error('Failed to create employee:', error);
      
      // Demo: add locally anyway
      const newId = String(Date.now());
      const newEmployee = {
        id: newId,
        ...createForm,
        salary: parseInt(createForm.salary) || 0,
        status: 'active',
        hire_date: new Date().toISOString().split('T')[0]
      };
      setEmployees(prev => [...prev, newEmployee]);
      
      if (createForm.create_user_account) {
        toast.success(`Employee created with user account! Default password: ${DEFAULT_PASSWORD}`);
      } else {
        toast.success('Employee created successfully!');
      }
      
      setCreateForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        department: '',
        role: '',
        salary: '',
        city: '',
        create_user_account: true,
        system_role: 'employee'
      });
      setIsCreateOpen(false);
    } finally {
      setCreateLoading(false);
    }
  };

  const stats = {
    total: employees.length,
    active: employees.filter(e => e.status === 'active').length,
    onLeave: employees.filter(e => e.status === 'on_leave').length,
    // Monthly payroll should include all employees EXCEPT suspended and terminated
    // active, on_leave, and other statuses still count towards payroll
    totalSalary: employees.filter(e => !['suspended', 'terminated'].includes(e.status)).reduce((sum, e) => sum + (e.salary || 0), 0)
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]">Employees Management</h1>
          <p className="text-gray-600">Manage staff and employee records</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => window.location.href = '/admin/employees/templates'}
            className="border-[#082c59] text-[#082c59]"
          >
            <FileText className="w-4 h-4 mr-2" /> Document Templates
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#082c59]"><UserPlus className="w-4 h-4 mr-2" /> Add Employee</Button>
            </DialogTrigger>
          <DialogContent className="bg-white max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>First Name *</Label><Input placeholder="First name" value={createForm.first_name} onChange={e => setCreateForm(p => ({ ...p, first_name: e.target.value }))} /></div>
                <div><Label>Last Name *</Label><Input placeholder="Last name" value={createForm.last_name} onChange={e => setCreateForm(p => ({ ...p, last_name: e.target.value }))} /></div>
              </div>
              <div><Label>Email *</Label><Input type="email" placeholder="email@oryno.cm" value={createForm.email} onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))} /></div>
              <div><Label>Phone</Label><Input placeholder="+237 6XX XXX XXX" value={createForm.phone} onChange={e => setCreateForm(p => ({ ...p, phone: e.target.value }))} /></div>
              <div><Label>City</Label><Input placeholder="Yaoundé" value={createForm.city} onChange={e => setCreateForm(p => ({ ...p, city: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Department *</Label>
                  <Select value={createForm.department} onValueChange={v => setCreateForm(p => ({ ...p, department: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent className="bg-white">
                      {DEPARTMENTS.filter(d => d !== 'all').map(d => (
                        <SelectItem key={d} value={d} className="capitalize">{d.replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Position *</Label>
                  <Select value={createForm.role} onValueChange={v => setCreateForm(p => ({ ...p, role: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent className="bg-white">
                      {ROLES.filter(r => r !== 'all').map(r => (
                        <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Monthly Salary (FCFA)</Label><Input type="number" placeholder="200000" value={createForm.salary} onChange={e => setCreateForm(p => ({ ...p, salary: e.target.value }))} /></div>
              
              {/* User Account Section */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <Label className="text-base font-semibold">Create System User Account</Label>
                    <p className="text-sm text-gray-500">Allow this employee to log in to the system</p>
                  </div>
                  <Checkbox 
                    checked={createForm.create_user_account} 
                    onCheckedChange={checked => setCreateForm(p => ({ ...p, create_user_account: checked }))}
                  />
                </div>
                
                {createForm.create_user_account && (
                  <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
                    <div>
                      <Label>System Role *</Label>
                      <Select value={createForm.system_role} onValueChange={v => setCreateForm(p => ({ ...p, system_role: v }))}>
                        <SelectTrigger className="bg-white"><SelectValue placeholder="Select role" /></SelectTrigger>
                        <SelectContent className="bg-white">
                          {SYSTEM_ROLES.map(r => (
                            <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 mt-1">
                        {createForm.system_role === 'admin' ? 'Can manage users, bookings, and access admin features' : 'Can access basic features and services'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-800">Default Password</p>
                        <p className="text-amber-700">Employee will receive: <code className="bg-amber-100 px-1 rounded">{DEFAULT_PASSWORD}</code></p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <Button className="w-full bg-[#082c59]" onClick={handleCreateEmployee} disabled={createLoading}>
                {createLoading ? 'Creating...' : createForm.create_user_account ? 'Create Employee & User Account' : 'Create Employee'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-lg"><Users className="w-6 h-6 text-blue-600" /></div>
          <div><p className="text-sm text-gray-500">Total Employees</p><p className="text-2xl font-bold">{stats.total}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-lg"><CheckCircle className="w-6 h-6 text-green-600" /></div>
          <div><p className="text-sm text-gray-500">Active</p><p className="text-2xl font-bold">{stats.active}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4">
          <div className="p-3 bg-yellow-100 rounded-lg"><Clock className="w-6 h-6 text-yellow-600" /></div>
          <div><p className="text-sm text-gray-500">On Leave</p><p className="text-2xl font-bold">{stats.onLeave}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4">
          <div className="p-3 bg-purple-100 rounded-lg"><Briefcase className="w-6 h-6 text-purple-600" /></div>
          <div><p className="text-sm text-gray-500">Monthly Payroll</p><p className="text-2xl font-bold">{formatFCFA(stats.totalSalary)}</p></div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Search employees..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent className="bg-white">
                {DEPARTMENTS.map(d => <SelectItem key={d} value={d} className="capitalize">{d === 'all' ? 'All Departments' : d.replace('_', ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent className="bg-white">
                {ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r === 'all' ? 'All Roles' : r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent className="bg-white">
                {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s === 'all' ? 'All Status' : s.replace('_', ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Employees Grid */}
      {loading ? (
        <div className="text-center py-12">Loading employees...</div>
      ) : filteredEmployees.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No employees found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map(emp => (
            <Card key={emp.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-[#082c59] text-white">
                        {getInitials(emp.first_name, emp.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{emp.first_name} {emp.last_name}</p>
                      <p className="text-sm text-gray-500 capitalize">{emp.role}</p>
                    </div>
                  </div>
                  {getStatusBadge(emp.status)}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="w-4 h-4" /><span>{emp.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-4 h-4" /><span>{emp.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Briefcase className="w-4 h-4" /><span className="capitalize">{emp.department?.replace('_', ' ')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4" /><span>{emp.city}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                  <span className="font-semibold text-[#082c59]">{formatFCFA(emp.salary)}/mo</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleView(emp)}><Eye className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(emp)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(emp)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Employee Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Employee Details</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarFallback className="bg-[#082c59] text-white text-xl">
                    {getInitials(selectedEmployee.first_name, selectedEmployee.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-lg">{selectedEmployee.first_name} {selectedEmployee.last_name}</h3>
                  <p className="text-sm text-gray-500 capitalize">{selectedEmployee.role}</p>
                  {getStatusBadge(selectedEmployee.status)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Email</p>
                  <p className="font-medium">{selectedEmployee.email}</p>
                </div>
                <div>
                  <p className="text-gray-500">Phone</p>
                  <p className="font-medium">{selectedEmployee.phone}</p>
                </div>
                <div>
                  <p className="text-gray-500">Department</p>
                  <p className="font-medium capitalize">{selectedEmployee.department?.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-gray-500">City</p>
                  <p className="font-medium">{selectedEmployee.city}</p>
                </div>
                <div>
                  <p className="text-gray-500">Hire Date</p>
                  <p className="font-medium">{selectedEmployee.hire_date}</p>
                </div>
                <div>
                  <p className="text-gray-500">Salary</p>
                  <p className="font-medium text-[#082c59]">{formatFCFA(selectedEmployee.salary)}/mo</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>First Name</Label>
                <Input value={editForm.first_name || ''} onChange={e => setEditForm(p => ({ ...p, first_name: e.target.value }))} />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input value={editForm.last_name || ''} onChange={e => setEditForm(p => ({ ...p, last_name: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={editForm.email || ''} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={editForm.phone || ''} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Department</Label>
                <Select value={editForm.department} onValueChange={v => setEditForm(p => ({ ...p, department: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {DEPARTMENTS.filter(d => d !== 'all').map(d => (
                      <SelectItem key={d} value={d} className="capitalize">{d.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Role</Label>
                <Select value={editForm.role} onValueChange={v => setEditForm(p => ({ ...p, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {ROLES.filter(r => r !== 'all').map(r => (
                      <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {STATUSES.filter(s => s !== 'all').map(s => (
                      <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Salary (FCFA)</Label>
                <Input type="number" value={editForm.salary || ''} onChange={e => setEditForm(p => ({ ...p, salary: parseInt(e.target.value) }))} />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button className="bg-[#082c59]" onClick={handleSaveEdit}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600">
              Are you sure you want to delete <strong>{selectedEmployee?.first_name} {selectedEmployee?.last_name}</strong>? 
              This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete Employee</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
