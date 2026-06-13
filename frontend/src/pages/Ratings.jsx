import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import api, { ratingsAPI } from '../api/client';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Star, MessageSquare, ThumbsUp, Calendar, Search, Filter,
  Hotel, Utensils, Bus, Car, Film, Sparkles, Package, Gift,
  Send, Reply, ChevronDown, ChevronUp, User, Clock, TrendingUp,
  MessageCircle, Award, BarChart3, Edit2, Loader2, CheckCircle,
  Flag, EyeOff, Eye, Trash2, AlertTriangle, ShieldAlert, X,
  PieChart, Activity, Users, ArrowUpRight, ArrowDownRight, Timer, FileText, LayoutGrid, List, Bell
} from 'lucide-react';
import { formatDate, formatDateTime, getTimeAgo } from '../utils/dateUtils';
import { toast } from 'sonner';
import MessagesTab from './loyalty/MessagesTab';
import OperatorScopeFilter from '../components/common/OperatorScopeFilter';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart as RePieChart, Pie, Cell, Legend
} from 'recharts';

const SERVICE_ICONS = {
  hotel: Hotel,
  restaurant: Utensils,
  travel: Bus,
  car_rental: Car,
  cinema: Film,
  laundry: Sparkles,
  package: Package,
  banquet: Gift,
  events: Calendar
};

const SERVICE_COLORS = {
  hotel: '#EC4899',
  restaurant: '#F59E0B',
  travel: '#3B82F6',
  car_rental: '#10B981',
  cinema: '#EF4444',
  laundry: '#06B6D4',
  package: '#6366F1',
  banquet: '#8B5CF6',
  events: '#F97316'
};

// Render star rating
const StarRating = ({ rating, size = 'md', interactive = false, onChange }) => {
  const [hovered, setHovered] = useState(0);
  const sizeClass = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => interactive && onChange?.(star)}
          onMouseEnter={() => interactive && setHovered(star)}
          onMouseLeave={() => interactive && setHovered(0)}
          className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}
        >
          <Star
            className={`${sizeClass} transition-colors ${
              star <= (hovered || rating)
                ? 'text-amber-400 fill-amber-400'
                : 'text-slate-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
};

// Customer View Component
function CustomerRatingsView() {
  const [ratings, setRatings] = useState([]);
  const [pendingRatings, setPendingRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRating, setEditingRating] = useState(null);
  const [editComment, setEditComment] = useState('');

  // New-rating modal (triggered from the "Awaiting rating" list)
  const [ratingTarget, setRatingTarget] = useState(null); // pending item being rated
  const [newRating, setNewRating] = useState(5);
  const [newReview, setNewReview] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  useEffect(() => {
    fetchRatings();
    fetchPending();
  }, []);

  const fetchRatings = async () => {
    try {
      const response = await ratingsAPI.getMyRatings();
      setRatings(response.data?.ratings || []);
    } catch {
      setRatings([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPending = async () => {
    try {
      const r = await api.get('/ratings/pending');
      setPendingRatings(r.data?.pending || []);
    } catch {
      setPendingRatings([]);
    }
  };

  const openRatingModal = (pending) => {
    setRatingTarget(pending);
    setNewRating(5);
    setNewReview('');
  };

  const submitNewRating = async () => {
    if (!ratingTarget) return;
    if (!newReview.trim()) {
      toast.error('Please add a short review to help others');
      return;
    }
    setSubmittingRating(true);
    try {
      await ratingsAPI.createRating({
        entity_type: ratingTarget.entity_type || ratingTarget.service_type,
        entity_id: ratingTarget.entity_id,
        rating: newRating,
        review: newReview.trim(),
        order_id: ratingTarget.order_id,
        order_number: ratingTarget.order_number,
        entity_name: ratingTarget.service_name,
        operator_id: ratingTarget.operator_id,
        operator_name: ratingTarget.operator_name,
        service_type: ratingTarget.service_type,
      });
      toast.success('Thanks! Your review is live.');
      setRatingTarget(null);
      // Refresh both lists
      await Promise.all([fetchRatings(), fetchPending()]);
    } catch (err) {
      const raw = err?.response?.data?.detail;
      toast.error(typeof raw === 'string' ? raw : 'Could not submit your review');
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleEditRating = (rating) => {
    setEditingRating(rating);
    setEditComment(rating.comment);
  };

  const handleSaveEdit = async () => {
    try {
      await ratingsAPI.updateRating(editingRating.id, { comment: editComment });
      setRatings(prev => prev.map(r => r.id === editingRating.id ? { ...r, comment: editComment } : r));
      setEditingRating(null);
      toast.success('Review updated successfully!');
    } catch (error) {
      toast.error('Failed to update review');
    }
  };

  const stats = useMemo(() => {
    if (!ratings.length) return { total: 0, helpful: 0, average: 0 };
    return {
      total: ratings.length,
      helpful: ratings.reduce((sum, r) => sum + (r.helpful_count || 0), 0),
      average: (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
    };
  }, [ratings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#082c59] mx-auto" />
          <p className="mt-4 text-slate-600">Loading your reviews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-xl">
                <Star className="h-6 w-6 text-amber-600 fill-amber-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
                <p className="text-sm text-slate-600">Total Reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <ThumbsUp className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900">{stats.helpful}</p>
                <p className="text-sm text-slate-600">Helpful Votes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 rounded-xl">
                <Award className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900">{stats.average}</p>
                <p className="text-sm text-slate-600">Average Rating</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Awaiting rating section ───────────────────────────────────── */}
      {pendingRatings.length > 0 && (
        <Card className="border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 mb-4" data-testid="awaiting-rating-section">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                  <Star className="h-5 w-5" fill="currentColor" />
                </div>
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    Awaiting rating / review
                    <Badge className="bg-amber-500 text-white">{pendingRatings.length}</Badge>
                  </CardTitle>
                  <p className="text-xs text-slate-600 mt-0.5">You&apos;ve used these services — share your experience to help other customers.</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingRatings.map((p) => {
                const PIcon = SERVICE_ICONS[p.service_type] || Package;
                const pColor = SERVICE_COLORS[p.service_type] || '#F59E0B';
                return (
                <div
                  key={p.order_id}
                  className="p-4 bg-white rounded-xl border border-amber-200 shadow-sm hover:shadow-md transition-all"
                  data-testid={`pending-rating-${p.order_id}`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${pColor}15` }}
                    >
                      <PIcon className="h-5 w-5" style={{ color: pColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate">{p.service_name}</p>
                      <p className="text-xs text-slate-500 truncate">{p.operator_name || '—'}</p>
                      {p.checked_in_at && (
                        <p className="text-xs text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Checked in {new Date(p.checked_in_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => openRatingModal(p)}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                    size="sm"
                    data-testid={`rate-now-btn-${p.order_id}`}
                  >
                    <Star className="h-4 w-4 mr-1.5" fill="currentColor" />
                    Rate &amp; Review
                  </Button>
                </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Rate Now Modal ────────────────────────────────────────────── */}
      <Dialog open={!!ratingTarget} onOpenChange={(open) => !open && setRatingTarget(null)}>
        <DialogContent className="bg-white max-w-md" data-testid="rating-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" fill="currentColor" />
              Rate &amp; Review
            </DialogTitle>
          </DialogHeader>
          {ratingTarget && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-sm font-bold text-slate-900">{ratingTarget.service_name}</p>
                <p className="text-xs text-slate-500">{ratingTarget.operator_name}</p>
              </div>

              <div>
                <Label className="text-sm font-semibold">Your rating</Label>
                <div className="flex gap-1 mt-2" data-testid="rating-stars">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNewRating(n)}
                      className="transition-transform hover:scale-110"
                      data-testid={`rating-star-${n}`}
                    >
                      <Star
                        className={`h-8 w-8 ${n <= newRating ? 'text-amber-500' : 'text-slate-300'}`}
                        fill={n <= newRating ? 'currentColor' : 'none'}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {newRating === 5 ? 'Excellent!' : newRating === 4 ? 'Great' : newRating === 3 ? 'Good' : newRating === 2 ? 'Okay' : 'Disappointing'}
                </p>
              </div>

              <div>
                <Label className="text-sm font-semibold">Your review *</Label>
                <Textarea
                  value={newReview}
                  onChange={(e) => setNewReview(e.target.value)}
                  placeholder="What stood out about this service?"
                  rows={4}
                  className="mt-1"
                  maxLength={500}
                  data-testid="rating-review-input"
                />
                <p className="text-xs text-slate-400 mt-1">{newReview.length}/500</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRatingTarget(null)}>Cancel</Button>
            <Button
              onClick={submitNewRating}
              disabled={submittingRating || !newReview.trim()}
              className="bg-amber-500 hover:bg-amber-600 text-white"
              data-testid="rating-submit-btn"
            >
              {submittingRating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Star className="h-4 w-4 mr-2" fill="currentColor" />}
              Submit review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reviews List */}
      {ratings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="h-10 w-10 text-amber-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No reviews yet</h3>
            <p className="text-slate-500 max-w-sm mx-auto">
              After using a service, come back here to share your experience and help others!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {ratings.map((review) => {
            const IconComponent = SERVICE_ICONS[review.service_category] || Package;
            const color = SERVICE_COLORS[review.service_category] || '#64748B';
            
            return (
              <Card key={review.id} className="overflow-hidden hover:shadow-lg transition-all duration-300 group">
                <CardContent className="p-0">
                  <div className="flex">
                    {/* Color accent bar */}
                    <div className="w-1.5" style={{ backgroundColor: color }}></div>
                    
                    <div className="flex-1 p-6">
                      <div className="flex gap-4">
                        {/* Service Icon */}
                        <div 
                          className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                          style={{ backgroundColor: `${color}15` }}
                        >
                          <IconComponent className="h-7 w-7" style={{ color }} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          {/* Header */}
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-bold text-slate-900 text-lg">{review.service_name}</h3>
                              <div className="flex items-center gap-3 mt-1">
                                <StarRating rating={review.rating} size="sm" />
                                <span className="text-sm text-slate-500 flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {formatDate(review.created_at)}
                                </span>
                              </div>
                            </div>
                            <Badge 
                              className="capitalize text-xs"
                              style={{ backgroundColor: `${color}20`, color }}
                            >
                              {review.service_category?.replace('_', ' ')}
                            </Badge>
                          </div>
                          
                          {/* Comment */}
                          <p className="text-slate-600 mt-4 leading-relaxed">{review.comment}</p>
                          
                          {/* Operator Response */}
                          {review.operator_response && (
                            <div className="mt-4 p-4 bg-slate-50 rounded-lg border-l-4 border-[#082c59]">
                              <div className="flex items-center gap-2 mb-2">
                                <Reply className="h-4 w-4 text-[#082c59]" />
                                <span className="font-medium text-[#082c59] text-sm">
                                  Response from {review.operator_response.responder_name}
                                </span>
                                <span className="text-xs text-slate-400">
                                  • {formatDate(review.operator_response.responded_at)}
                                </span>
                              </div>
                              <p className="text-slate-600 text-sm">{review.operator_response.message}</p>
                            </div>
                          )}
                          
                          {/* Actions */}
                          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100">
                            <span className="flex items-center gap-1.5 text-sm text-slate-500">
                              <ThumbsUp className="h-4 w-4" />
                              {review.helpful_count || 0} found helpful
                            </span>
                            <button 
                              onClick={() => handleEditRating(review)}
                              className="flex items-center gap-1.5 text-sm text-[#082c59] hover:underline"
                            >
                              <Edit2 className="h-4 w-4" />
                              Edit Review
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingRating} onOpenChange={() => setEditingRating(null)}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle>Edit Your Review</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Your Review</label>
              <Textarea
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
                className="mt-2"
                rows={4}
                placeholder="Share your experience..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRating(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} className="bg-[#082c59] hover:bg-[#0a3a75]">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Operator View Component
function OperatorRatingsView() {
  const { user, operatorServiceTypes, operatorType } = useAuth();
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterService, setFilterService] = useState('all');
  const [filterRating, setFilterRating] = useState('all');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Determine operator's assigned service types
  const assignedServices = useMemo(() => {
    if (operatorServiceTypes?.length > 0) return operatorServiceTypes;
    if (operatorType) return [operatorType];
    return [];
  }, [operatorServiceTypes, operatorType]);

  useEffect(() => {
    fetchOperatorRatings();
  }, []);

  const fetchOperatorRatings = async () => {
    try {
      // Fetch ratings for services assigned to this operator
      const response = await api.get('/ratings/operator', {
        params: { operator_id: user?.operator_id }
      });
      setRatings(response.data?.ratings || []);
    } catch (error) {
      console.error('Failed to fetch operator ratings:', error);
      // Mock data for demo
      const mockRatings = [
        {
          id: 'r1',
          service_name: 'Hilton Douala',
          service_id: 'hotel_1',
          service_category: 'hotel',
          customer_name: 'John Doe',
          customer_avatar: null,
          rating: 5,
          comment: 'Amazing hotel! Clean rooms, friendly staff, great location. Highly recommend!',
          created_at: '2024-12-20T10:30:00Z',
          helpful_count: 15,
          operator_response: null
        },
        {
          id: 'r2',
          service_name: 'Hilton Douala',
          service_id: 'hotel_1',
          service_category: 'hotel',
          customer_name: 'Marie Claire',
          customer_avatar: null,
          rating: 4,
          comment: 'Very good experience overall. The breakfast buffet could have more variety.',
          created_at: '2024-12-18T14:15:00Z',
          helpful_count: 8,
          operator_response: {
            message: 'Thank you for your feedback! We are working on expanding our breakfast menu.',
            responded_at: '2024-12-19T09:00:00Z',
            responder_name: 'Hotel Management'
          }
        },
        {
          id: 'r3',
          service_name: 'La Belle Époque',
          service_id: 'rest_1',
          service_category: 'restaurant',
          customer_name: 'Pierre Martin',
          customer_avatar: null,
          rating: 5,
          comment: 'Best restaurant in town! The chef is incredibly talented.',
          created_at: '2024-12-15T19:45:00Z',
          helpful_count: 22,
          operator_response: null
        },
        {
          id: 'r4',
          service_name: 'Hilton Douala',
          service_id: 'hotel_1',
          service_category: 'hotel',
          customer_name: 'Sophie Williams',
          customer_avatar: null,
          rating: 3,
          comment: 'The room was nice but the AC was too noisy. Front desk was helpful in resolving.',
          created_at: '2024-12-12T08:20:00Z',
          helpful_count: 5,
          operator_response: null
        }
      ];
      // Filter by assigned services
      const filtered = mockRatings.filter(r => 
        assignedServices.length === 0 || assignedServices.includes(r.service_category)
      );
      setRatings(filtered);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReply = async () => {
    if (!replyText.trim() || !replyingTo) return;
    
    setSubmittingReply(true);
    try {
      await api.post(`/ratings/${replyingTo.id}/respond`, {
        message: replyText,
        responder_name: user?.full_name || 'Management'
      });
      
      // Update local state
      setRatings(prev => prev.map(r => 
        r.id === replyingTo.id 
          ? { 
              ...r, 
              operator_response: {
                message: replyText,
                responded_at: new Date().toISOString(),
                responder_name: user?.full_name || 'Management'
              }
            }
          : r
      ));
      
      setReplyingTo(null);
      setReplyText('');
      toast.success('Response submitted successfully!');
    } catch (error) {
      toast.error('Failed to submit response');
    } finally {
      setSubmittingReply(false);
    }
  };

  // Filter ratings
  const filteredRatings = useMemo(() => {
    return ratings.filter(r => {
      const matchesSearch = !searchTerm || 
        r.service_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.comment.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesService = filterService === 'all' || r.service_category === filterService;
      const matchesRating = filterRating === 'all' || r.rating === parseInt(filterRating);
      return matchesSearch && matchesService && matchesRating;
    });
  }, [ratings, searchTerm, filterService, filterRating]);

  // Stats
  const stats = useMemo(() => {
    if (!ratings.length) return { total: 0, average: 0, responded: 0, pending: 0 };
    return {
      total: ratings.length,
      average: (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1),
      responded: ratings.filter(r => r.operator_response).length,
      pending: ratings.filter(r => !r.operator_response).length
    };
  }, [ratings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#082c59] mx-auto" />
          <p className="mt-4 text-slate-600">Loading customer reviews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                <p className="text-xs text-slate-600">Total Reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 rounded-lg">
                <Star className="h-5 w-5 text-amber-600 fill-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.average}</p>
                <p className="text-xs text-slate-600">Avg Rating</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.responded}</p>
                <p className="text-xs text-slate-600">Responded</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-rose-50 to-pink-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 rounded-lg">
                <MessageCircle className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
                <p className="text-xs text-slate-600">Needs Response</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search reviews..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>
            <Select value={filterService} onValueChange={setFilterService}>
              <SelectTrigger className="w-40 bg-white">
                <SelectValue placeholder="Service" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Services</SelectItem>
                {assignedServices.map(service => (
                  <SelectItem key={service} value={service} className="capitalize">
                    {service.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterRating} onValueChange={setFilterRating}>
              <SelectTrigger className="w-36 bg-white">
                <SelectValue placeholder="Rating" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Ratings</SelectItem>
                <SelectItem value="5">5 Stars</SelectItem>
                <SelectItem value="4">4 Stars</SelectItem>
                <SelectItem value="3">3 Stars</SelectItem>
                <SelectItem value="2">2 Stars</SelectItem>
                <SelectItem value="1">1 Star</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Reviews List */}
      {filteredRatings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Star className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-700 mb-2">No reviews found</h3>
            <p className="text-slate-500">
              {searchTerm || filterService !== 'all' || filterRating !== 'all'
                ? 'Try adjusting your filters'
                : 'Customer reviews for your services will appear here'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRatings.map((review) => {
            const IconComponent = SERVICE_ICONS[review.service_category] || Package;
            const color = SERVICE_COLORS[review.service_category] || '#64748B';
            const needsResponse = !review.operator_response;
            
            return (
              <Card 
                key={review.id} 
                className={`overflow-hidden transition-all duration-300 ${needsResponse ? 'ring-2 ring-amber-200' : ''}`}
              >
                <CardContent className="p-0">
                  <div className="flex">
                    {/* Status bar */}
                    <div 
                      className="w-1.5"
                      style={{ backgroundColor: needsResponse ? '#F59E0B' : '#10B981' }}
                    ></div>
                    
                    <div className="flex-1 p-6">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                            <User className="h-5 w-5 text-slate-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{review.customer_name}</p>
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              <Clock className="h-3.5 w-3.5" />
                              {formatDate(review.created_at)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            className="capitalize text-xs"
                            style={{ backgroundColor: `${color}20`, color }}
                          >
                            <IconComponent className="h-3 w-3 mr-1" />
                            {review.service_name}
                          </Badge>
                          {needsResponse && (
                            <Badge className="bg-amber-100 text-amber-700 text-xs">
                              Needs Response
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Rating & Comment */}
                      <div className="mb-4">
                        <StarRating rating={review.rating} />
                        <p className="text-slate-700 mt-3 leading-relaxed">{review.comment}</p>
                      </div>

                      {/* Existing Response */}
                      {review.operator_response && (
                        <div className="mt-4 p-4 bg-emerald-50 rounded-lg border-l-4 border-emerald-500">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                            <span className="font-medium text-emerald-700 text-sm">
                              Your Response
                            </span>
                            <span className="text-xs text-slate-500">
                              • {formatDate(review.operator_response.responded_at)}
                            </span>
                          </div>
                          <p className="text-slate-700 text-sm">{review.operator_response.message}</p>
                        </div>
                      )}

                      {/* Reply Section */}
                      {replyingTo?.id === review.id ? (
                        <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                          <Textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Write your response to this review..."
                            className="mb-3"
                            rows={3}
                          />
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => { setReplyingTo(null); setReplyText(''); }}
                            >
                              Cancel
                            </Button>
                            <Button 
                              size="sm"
                              onClick={handleSubmitReply}
                              disabled={!replyText.trim() || submittingReply}
                              className="bg-[#082c59] hover:bg-[#0a3a75]"
                            >
                              {submittingReply ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Send className="h-4 w-4 mr-2" />
                              )}
                              Submit Response
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-sm text-slate-500">
                            <ThumbsUp className="h-4 w-4" />
                            {review.helpful_count || 0} helpful votes
                          </span>
                          {!review.operator_response && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setReplyingTo(review)}
                              className="gap-2"
                            >
                              <Reply className="h-4 w-4" />
                              Respond
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Admin View Component - Shows all ratings across the platform with moderation tools
function AdminRatingsView() {
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterService, setFilterService] = useState('all');
  const [filterRating, setFilterRating] = useState('all');
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [selectedRating, setSelectedRating] = useState(null);
  const [showModerateDialog, setShowModerateDialog] = useState(false);
  const [moderationAction, setModerationAction] = useState('');
  const [moderationReason, setModerationReason] = useState('');
  const [submittingModeration, setSubmittingModeration] = useState(false);
  
  // Bulk selection state
  const [selectedRatings, setSelectedRatings] = useState(new Set());
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [submittingBulk, setSubmittingBulk] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  useEffect(() => {
    fetchAllRatings();
  }, [showFlaggedOnly]);

  const fetchAllRatings = async () => {
    setLoading(true);
    try {
      // Fetch all ratings across the platform
      const response = await api.get('/ratings/all', {
        params: { flagged_only: showFlaggedOnly }
      });
      setRatings(response.data?.ratings || []);
    } catch (error) {
      console.error('Failed to fetch all ratings:', error);
      // Mock data for demo
      setRatings([
        {
          id: 'ar1',
          service_name: 'Hilton Douala',
          service_id: 'hotel_1',
          service_category: 'hotel',
          customer_name: 'John Doe',
          operator_name: 'Hilton Hotels Group',
          rating: 5,
          comment: 'Amazing hotel! Clean rooms, friendly staff, great location.',
          created_at: '2024-12-20T10:30:00Z',
          helpful_count: 15,
          is_flagged: false,
          is_hidden: false,
          operator_response: {
            message: 'Thank you for your wonderful review!',
            responded_at: '2024-12-21T09:00:00Z',
            responder_name: 'Hotel Manager'
          }
        },
        {
          id: 'ar2',
          service_name: 'La Belle Époque',
          service_id: 'rest_1',
          service_category: 'restaurant',
          customer_name: 'Marie Claire',
          operator_name: 'Restaurant Group Douala',
          rating: 4,
          comment: 'Great food and ambiance. Service was a bit slow during peak hours.',
          created_at: '2024-12-19T14:15:00Z',
          helpful_count: 8,
          is_flagged: false,
          is_hidden: false,
          operator_response: null
        },
        {
          id: 'ar3',
          service_name: 'Douala → Yaoundé Express',
          service_id: 'travel_1',
          service_category: 'travel',
          customer_name: 'Pierre Martin',
          operator_name: 'Express Travel Co',
          rating: 5,
          comment: 'Very comfortable bus, arrived on time. Will definitely use again!',
          created_at: '2024-12-18T08:20:00Z',
          helpful_count: 22,
          is_flagged: true,
          is_hidden: false,
          operator_response: null
        },
        {
          id: 'ar4',
          service_name: 'Premium Car Rental',
          service_id: 'car_1',
          service_category: 'car_rental',
          customer_name: 'Sophie Williams',
          operator_name: 'AutoRent Cameroon',
          rating: 3,
          comment: 'Car was okay but could have been cleaner. Good price though.',
          created_at: '2024-12-15T11:45:00Z',
          helpful_count: 5,
          is_flagged: false,
          is_hidden: false,
          operator_response: {
            message: 'We apologize for the inconvenience. We have addressed this with our cleaning team.',
            responded_at: '2024-12-16T10:00:00Z',
            responder_name: 'Operations Manager'
          }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleModerate = (rating, action) => {
    setSelectedRating(rating);
    setModerationAction(action);
    setModerationReason('');
    setShowModerateDialog(true);
  };

  const submitModeration = async () => {
    if (!selectedRating || !moderationAction) return;
    
    setSubmittingModeration(true);
    try {
      await api.post(`/ratings/${selectedRating.id}/moderate`, {
        action: moderationAction,
        reason: moderationReason
      });
      
      // Update local state
      if (moderationAction === 'delete') {
        setRatings(prev => prev.filter(r => r.id !== selectedRating.id));
        toast.success('Rating deleted successfully');
      } else {
        setRatings(prev => prev.map(r => {
          if (r.id !== selectedRating.id) return r;
          return {
            ...r,
            is_flagged: moderationAction === 'flag' ? true : moderationAction === 'unflag' ? false : r.is_flagged,
            is_hidden: moderationAction === 'hide' ? true : moderationAction === 'unhide' ? false : r.is_hidden,
            moderation_notes: moderationReason || r.moderation_notes
          };
        }));
        toast.success(`Rating ${moderationAction}ged successfully`);
      }
      
      setShowModerateDialog(false);
      setSelectedRating(null);
    } catch (error) {
      console.error('Moderation failed:', error);
      toast.error(error.response?.data?.detail || 'Moderation failed');
    } finally {
      setSubmittingModeration(false);
    }
  };

  // Bulk selection handlers
  const handleSelectRating = (ratingId, checked) => {
    setSelectedRatings(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(ratingId);
      } else {
        newSet.delete(ratingId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedRatings(new Set(filteredRatings.map(r => r.id)));
    } else {
      setSelectedRatings(new Set());
    }
  };

  const openBulkDialog = (action) => {
    if (selectedRatings.size === 0) {
      toast.error('Please select at least one rating');
      return;
    }
    setBulkAction(action);
    setBulkReason('');
    setShowBulkDialog(true);
  };

  const submitBulkAction = async () => {
    if (selectedRatings.size === 0) return;
    
    setSubmittingBulk(true);
    try {
      const ratingIds = Array.from(selectedRatings);
      
      // Call API for bulk moderation
      await api.post('/ratings/bulk-moderate', {
        rating_ids: ratingIds,
        action: bulkAction,
        reason: bulkReason
      });
      
      // Update local state based on action
      if (bulkAction === 'delete') {
        setRatings(prev => prev.filter(r => !selectedRatings.has(r.id)));
        toast.success(`${selectedRatings.size} rating(s) deleted successfully`);
      } else {
        setRatings(prev => prev.map(r => {
          if (!selectedRatings.has(r.id)) return r;
          return {
            ...r,
            is_flagged: bulkAction === 'flag' ? true : bulkAction === 'unflag' ? false : r.is_flagged,
            is_hidden: bulkAction === 'hide' ? true : bulkAction === 'unhide' ? false : r.is_hidden,
            moderation_notes: bulkReason || r.moderation_notes
          };
        }));
        toast.success(`${selectedRatings.size} rating(s) ${bulkAction}ged successfully`);
      }
      
      setSelectedRatings(new Set());
      setShowBulkDialog(false);
    } catch (error) {
      console.error('Bulk moderation failed:', error);
      toast.error(error.response?.data?.detail || 'Bulk moderation failed');
    } finally {
      setSubmittingBulk(false);
    }
  };

  // Filter ratings
  const filteredRatings = useMemo(() => {
    return ratings.filter(r => {
      const matchesSearch = !searchTerm || 
        r.service_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.operator_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.comment.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesService = filterService === 'all' || r.service_category === filterService;
      const matchesRating = filterRating === 'all' || r.rating === parseInt(filterRating);
      return matchesSearch && matchesService && matchesRating;
    });
  }, [ratings, searchTerm, filterService, filterRating]);

  // Stats
  const stats = useMemo(() => {
    if (!ratings.length) return { total: 0, average: 0, responded: 0, pending: 0, flagged: 0, byRating: {} };
    const byRating = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    ratings.forEach(r => byRating[r.rating] = (byRating[r.rating] || 0) + 1);
    return {
      total: ratings.length,
      average: (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1),
      responded: ratings.filter(r => r.operator_response).length,
      pending: ratings.filter(r => !r.operator_response).length,
      flagged: ratings.filter(r => r.is_flagged).length,
      byRating
    };
  }, [ratings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#082c59] mx-auto" />
          <p className="mt-4 text-slate-600">Loading all ratings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                <p className="text-xs text-slate-600">Total Reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 rounded-lg">
                <Star className="h-5 w-5 text-amber-600 fill-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.average}</p>
                <p className="text-xs text-slate-600">Avg Rating</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.responded}</p>
                <p className="text-xs text-slate-600">Responded</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-rose-50 to-pink-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 rounded-lg">
                <MessageCircle className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
                <p className="text-xs text-slate-600">Needs Response</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-0 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowFlaggedOnly(!showFlaggedOnly)}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-orange-100 rounded-lg">
                <Flag className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.flagged}</p>
                <p className="text-xs text-slate-600">{showFlaggedOnly ? 'Showing Flagged' : 'Flagged'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-0">
          <CardContent className="p-4">
            <div className="text-xs space-y-1">
              {[5,4,3,2,1].map(star => (
                <div key={star} className="flex items-center gap-2">
                  <span className="w-3">{star}★</span>
                  <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: `${stats.total ? (stats.byRating[star] / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-slate-500">{stats.byRating[star] || 0}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-gradient-to-r from-[#082c59]/5 to-slate-100 border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by service, customer, operator..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>
            <Select value={filterService} onValueChange={setFilterService}>
              <SelectTrigger className="w-40 bg-white">
                <SelectValue placeholder="Service" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Services</SelectItem>
                <SelectItem value="hotel">Hotels</SelectItem>
                <SelectItem value="restaurant">Restaurants</SelectItem>
                <SelectItem value="travel">Travel</SelectItem>
                <SelectItem value="car_rental">Car Rental</SelectItem>
                <SelectItem value="cinema">Cinema</SelectItem>
                <SelectItem value="laundry">Laundry</SelectItem>
                <SelectItem value="events">Events</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterRating} onValueChange={setFilterRating}>
              <SelectTrigger className="w-36 bg-white">
                <SelectValue placeholder="Rating" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Ratings</SelectItem>
                <SelectItem value="5">5 Stars</SelectItem>
                <SelectItem value="4">4 Stars</SelectItem>
                <SelectItem value="3">3 Stars</SelectItem>
                <SelectItem value="2">2 Stars</SelectItem>
                <SelectItem value="1">1 Star</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1.5 whitespace-nowrap" data-testid="export-ratings-btn" onClick={async () => {
              try {
                const params = filterService !== 'all' ? `?service_type=${filterService}` : '';
                const res = await api.get(`/ratings/export${params}`);
                const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `ratings_export_${new Date().toISOString().split('T')[0]}.json`; a.click();
                URL.revokeObjectURL(url);
                toast.success(`Exported ${res.data.total} ratings`);
              } catch { toast.error('Export failed'); }
            }}>
              <FileText className="h-4 w-4" /> Export
            </Button>
            <div className="flex border rounded-lg overflow-hidden">
              <button onClick={() => setViewMode('list')} className={`px-2.5 py-1.5 ${viewMode === 'list' ? 'bg-[#082c59] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`} data-testid="list-view-btn">
                <List className="h-4 w-4" />
              </button>
              <button onClick={() => setViewMode('grid')} className={`px-2.5 py-1.5 ${viewMode === 'grid' ? 'bg-[#082c59] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`} data-testid="grid-view-btn">
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      <Card className={`transition-all ${selectedRatings.size > 0 ? 'bg-[#082c59] text-white' : 'bg-slate-50'}`}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox 
                checked={filteredRatings.length > 0 && selectedRatings.size === filteredRatings.length}
                onCheckedChange={handleSelectAll}
                className={selectedRatings.size > 0 ? 'border-white data-[state=checked]:bg-white data-[state=checked]:text-[#082c59]' : ''}
              />
              <span className={`text-sm font-medium ${selectedRatings.size > 0 ? 'text-white' : 'text-slate-600'}`}>
                {selectedRatings.size > 0 
                  ? `${selectedRatings.size} rating${selectedRatings.size > 1 ? 's' : ''} selected`
                  : 'Select ratings for bulk actions'}
              </span>
            </div>
            {selectedRatings.size > 0 && (
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={() => openBulkDialog('flag')}
                  className="bg-orange-500 hover:bg-orange-600 text-white border-0"
                >
                  <Flag className="h-4 w-4 mr-1" /> Flag All
                </Button>
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={() => openBulkDialog('unflag')}
                  className="bg-green-500 hover:bg-green-600 text-white border-0"
                >
                  <CheckCircle className="h-4 w-4 mr-1" /> Unflag All
                </Button>
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={() => openBulkDialog('hide')}
                  className="bg-slate-500 hover:bg-slate-600 text-white border-0"
                >
                  <EyeOff className="h-4 w-4 mr-1" /> Hide All
                </Button>
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={() => openBulkDialog('unhide')}
                  className="bg-blue-500 hover:bg-blue-600 text-white border-0"
                >
                  <Eye className="h-4 w-4 mr-1" /> Show All
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => openBulkDialog('delete')}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Delete All
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => setSelectedRatings(new Set())}
                  className="text-white hover:bg-white/20"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ratings List */}
      {filteredRatings.length === 0 ? (
        <Card className="border-dashed bg-gradient-to-r from-[#082c59]/5 to-slate-100">
          <CardContent className="py-16 text-center">
            <Star className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-700 mb-2">No reviews found</h3>
            <p className="text-slate-500">
              {searchTerm || filterService !== 'all' || filterRating !== 'all'
                ? 'Try adjusting your filters'
                : 'No reviews have been submitted yet'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-3'}>
          {filteredRatings.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE).map((review) => {
            const IconComponent = SERVICE_ICONS[review.service_category] || Package;
            const color = SERVICE_COLORS[review.service_category] || '#64748B';
            const needsResponse = !review.operator_response;
            
            return (
              <Card key={review.id} className={`overflow-hidden transition-all duration-300 hover:shadow-md bg-gradient-to-r from-[#082c59]/[0.03] to-slate-50 ${review.is_flagged ? 'ring-2 ring-orange-300' : ''} ${review.is_hidden ? 'opacity-60' : ''}`}>
                <CardContent className="p-0">
                  <div className="flex">
                    <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: review.is_flagged ? '#F97316' : needsResponse ? '#F59E0B' : '#10B981' }}></div>
                    
                    <div className="flex items-start p-3">
                      <Checkbox 
                        checked={selectedRatings.has(review.id)}
                        onCheckedChange={(checked) => handleSelectRating(review.id, checked)}
                        className="mt-1"
                      />
                    </div>
                    
                    <div className={`flex-1 ${viewMode === 'grid' ? 'p-4 pl-0' : 'p-5 pl-0'}`}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                            <User className="h-4 w-4 text-slate-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-slate-900">{review.customer_name}</p>
                            <span className="text-[10px] text-slate-400">{formatDate(review.created_at)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          <Badge className="capitalize text-[10px]" style={{ backgroundColor: `${color}20`, color }}>
                            <IconComponent className="h-2.5 w-2.5 mr-0.5" />
                            {review.service_name}
                          </Badge>
                          {review.is_flagged && <Badge className="bg-orange-100 text-orange-700 text-[10px]"><Flag className="h-2.5 w-2.5 mr-0.5" />Flagged</Badge>}
                          {review.is_hidden && <Badge className="bg-slate-100 text-slate-700 text-[10px]"><EyeOff className="h-2.5 w-2.5 mr-0.5" />Hidden</Badge>}
                        </div>
                      </div>

                      <StarRating rating={review.rating} />
                      <p className={`text-slate-700 mt-2 leading-relaxed ${viewMode === 'grid' ? 'text-xs line-clamp-3' : 'text-sm line-clamp-2'}`}>{review.comment}</p>

                      {review.operator_response && (
                        <div className="mt-2 p-2.5 bg-emerald-50 rounded-lg border-l-3 border-emerald-500 text-xs">
                          <span className="text-emerald-700 font-medium">{review.operator_response.responder_name}:</span>
                          <span className="text-slate-600 ml-1">{review.operator_response.message}</span>
                        </div>
                      )}

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <ThumbsUp className="h-3 w-3" /> {review.helpful_count || 0}
                        </span>
                        <div className="flex items-center gap-1">
                          {review.is_flagged ? (
                            <Button variant="ghost" size="sm" onClick={() => handleModerate(review, 'unflag')} className="h-7 text-[10px] text-green-600 hover:bg-green-50 px-2">Unflag</Button>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => handleModerate(review, 'flag')} className="h-7 text-[10px] text-orange-600 hover:bg-orange-50 px-2">Flag</Button>
                          )}
                          {review.is_hidden ? (
                            <Button variant="ghost" size="sm" onClick={() => handleModerate(review, 'unhide')} className="h-7 text-[10px] text-blue-600 hover:bg-blue-50 px-2">Show</Button>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => handleModerate(review, 'hide')} className="h-7 text-[10px] text-slate-600 hover:bg-slate-50 px-2">Hide</Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleModerate(review, 'delete')} className="h-7 text-[10px] text-red-600 hover:bg-red-50 px-2">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        {/* Pagination */}
        {filteredRatings.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between pt-4">
            <span className="text-sm text-slate-500">
              Showing {((page - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(page * ITEMS_PER_PAGE, filteredRatings.length)} of {filteredRatings.length}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: Math.ceil(filteredRatings.length / ITEMS_PER_PAGE) }, (_, i) => (
                <button key={i} onClick={() => setPage(i + 1)} className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${page === i + 1 ? 'bg-[#082c59] text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`} data-testid={`page-${i + 1}`}>
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}
        </>
      )}

      {/* Moderation Dialog */}
      <Dialog open={showModerateDialog} onOpenChange={setShowModerateDialog}>
        <DialogContent className="bg-gradient-to-br from-slate-50 to-[#082c59]/5 border-slate-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-orange-500" />
              {moderationAction === 'delete' ? 'Delete Rating' : 
               moderationAction === 'flag' ? 'Flag Rating' :
               moderationAction === 'unflag' ? 'Remove Flag' :
               moderationAction === 'hide' ? 'Hide Rating' : 'Show Rating'}
            </DialogTitle>
            <DialogDescription>
              {moderationAction === 'delete' 
                ? 'This action cannot be undone. The rating will be permanently removed.'
                : moderationAction === 'flag'
                ? 'Flag this rating for review. It will remain visible but marked for attention.'
                : moderationAction === 'hide'
                ? 'Hide this rating from public view. It can be restored later.'
                : 'This will update the rating status.'}
            </DialogDescription>
          </DialogHeader>
          {selectedRating && (
            <div className="py-4">
              <div className="p-3 bg-slate-50 rounded-lg mb-4">
                <p className="font-medium text-sm">{selectedRating.service_name}</p>
                <p className="text-sm text-slate-600">by {selectedRating.customer_name}</p>
                <StarRating rating={selectedRating.rating} size="sm" />
              </div>
              {(moderationAction === 'flag' || moderationAction === 'hide' || moderationAction === 'delete') && (
                <div>
                  <label className="text-sm font-medium">Reason (optional)</label>
                  <Textarea
                    value={moderationReason}
                    onChange={(e) => setModerationReason(e.target.value)}
                    placeholder="Add a note about this moderation action..."
                    className="mt-2"
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModerateDialog(false)} disabled={submittingModeration}>
              Cancel
            </Button>
            <Button 
              onClick={submitModeration} 
              disabled={submittingModeration}
              className={moderationAction === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#082c59] hover:bg-[#0a3a75]'}
            >
              {submittingModeration && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {moderationAction === 'delete' ? 'Delete' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="bg-gradient-to-br from-slate-50 to-[#082c59]/5 border-slate-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-orange-500" />
              Bulk {bulkAction === 'delete' ? 'Delete' : 
                    bulkAction === 'flag' ? 'Flag' :
                    bulkAction === 'unflag' ? 'Unflag' :
                    bulkAction === 'hide' ? 'Hide' : 'Show'} Ratings
            </DialogTitle>
            <DialogDescription>
              {bulkAction === 'delete' 
                ? `This will permanently delete ${selectedRatings.size} rating(s). This action cannot be undone.`
                : bulkAction === 'flag'
                ? `This will flag ${selectedRatings.size} rating(s) for review.`
                : bulkAction === 'hide'
                ? `This will hide ${selectedRatings.size} rating(s) from public view.`
                : `This will update ${selectedRatings.size} rating(s).`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-3 bg-slate-50 rounded-lg mb-4">
              <p className="font-medium text-sm">{selectedRatings.size} rating(s) selected</p>
              <p className="text-sm text-slate-600">
                {bulkAction === 'delete' ? 'These ratings will be permanently removed' : 
                 bulkAction === 'flag' ? 'These ratings will be flagged for review' :
                 bulkAction === 'hide' ? 'These ratings will be hidden from public view' :
                 'These ratings will be updated'}
              </p>
            </div>
            {(bulkAction === 'flag' || bulkAction === 'hide' || bulkAction === 'delete') && (
              <div>
                <label className="text-sm font-medium">Reason (optional)</label>
                <Textarea
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  placeholder="Add a note about this bulk action..."
                  className="mt-2"
                  rows={3}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)} disabled={submittingBulk}>
              Cancel
            </Button>
            <Button 
              onClick={submitBulkAction} 
              disabled={submittingBulk}
              className={bulkAction === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#082c59] hover:bg-[#0a3a75]'}
            >
              {submittingBulk && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {bulkAction === 'delete' ? `Delete ${selectedRatings.size}` : `Confirm ${selectedRatings.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Chart colors for reports
const CHART_COLORS = ['#082c59', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

// Admin Reports View Component
function AdminReportsView() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await api.get('/ratings/reports/analytics', {
        params: { time_range: timeRange }
      });
      setAnalytics(response.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      // Provide mock data for development
      setAnalytics({
        summary: {
          total_ratings: 156,
          average_rating: 4.2,
          response_rate: 67.5,
          avg_response_time_hours: 12.3,
          flagged_count: 8,
          hidden_count: 3,
          five_star_percent: 45.5,
          negative_percent: 8.2
        },
        trends: [
          { date: '2024-12-01', count: 5, average: 4.2, flagged: 0 },
          { date: '2024-12-05', count: 8, average: 4.5, flagged: 1 },
          { date: '2024-12-10', count: 12, average: 4.1, flagged: 0 },
          { date: '2024-12-15', count: 15, average: 4.3, flagged: 2 },
          { date: '2024-12-20', count: 10, average: 4.0, flagged: 1 }
        ],
        by_category: [
          { category: 'hotel', count: 45, average: 4.3, responded: 35, response_rate: 77.8, flagged: 2, distribution: { 5: 20, 4: 15, 3: 7, 2: 2, 1: 1 } },
          { category: 'restaurant', count: 38, average: 4.1, responded: 22, response_rate: 57.9, flagged: 3, distribution: { 5: 15, 4: 12, 3: 8, 2: 2, 1: 1 } },
          { category: 'travel', count: 32, average: 4.4, responded: 28, response_rate: 87.5, flagged: 1, distribution: { 5: 16, 4: 10, 3: 4, 2: 1, 1: 1 } },
          { category: 'car_rental', count: 25, average: 3.9, responded: 15, response_rate: 60.0, flagged: 2, distribution: { 5: 8, 4: 9, 3: 5, 2: 2, 1: 1 } },
          { category: 'cinema', count: 16, average: 4.5, responded: 10, response_rate: 62.5, flagged: 0, distribution: { 5: 10, 4: 4, 3: 2, 2: 0, 1: 0 } }
        ],
        flagged_analysis: {
          by_category: [
            { category: 'restaurant', count: 3, avg_rating: 2.3 },
            { category: 'hotel', count: 2, avg_rating: 2.0 },
            { category: 'car_rental', count: 2, avg_rating: 1.5 },
            { category: 'travel', count: 1, avg_rating: 2.0 }
          ],
          recent: []
        },
        top_operators: [
          { name: 'Express Travel Co', total: 32, responded: 28, response_rate: 87.5, avg_rating: 4.4 },
          { name: 'Hilton Hotels Group', total: 25, responded: 20, response_rate: 80.0, avg_rating: 4.5 },
          { name: 'Premium Car Rental', total: 20, responded: 14, response_rate: 70.0, avg_rating: 4.0 }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#082c59] mx-auto" />
          <p className="mt-4 text-slate-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center">
          <BarChart3 className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-700 mb-2">No analytics data</h3>
          <p className="text-slate-500">Analytics will appear here once ratings are available</p>
        </CardContent>
      </Card>
    );
  }

  const { summary, trends, by_category, flagged_analysis, top_operators } = analytics;

  // Prepare chart data
  const categoryPieData = by_category?.map(c => ({
    name: c.category?.charAt(0).toUpperCase() + c.category?.slice(1).replace('_', ' '),
    value: c.count
  })) || [];

  const responseRateData = by_category?.map(c => ({
    category: c.category?.charAt(0).toUpperCase() + c.category?.slice(1).replace('_', ' '),
    rate: c.response_rate
  })) || [];

  return (
    <div className="space-y-6" data-testid="ratings-reports">
      {/* Time Range Filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-[#082c59]" />
          <span className="font-medium text-slate-700">Time Period:</span>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-40 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
            <SelectItem value="1y">Last Year</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">Total Ratings</p>
                <p className="text-2xl font-bold text-slate-900">{summary.total_ratings}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <MessageSquare className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">Average Rating</p>
                <p className="text-2xl font-bold text-slate-900">{summary.average_rating}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                  <span className="text-xs text-slate-500">{summary.five_star_percent}% 5-star</span>
                </div>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl">
                <Star className="h-6 w-6 text-amber-600 fill-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">Response Rate</p>
                <p className="text-2xl font-bold text-slate-900">{summary.response_rate}%</p>
                <div className="flex items-center gap-1 mt-1">
                  <Timer className="h-3 w-3 text-emerald-500" />
                  <span className="text-xs text-slate-500">Avg {summary.avg_response_time_hours}h</span>
                </div>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl">
                <Reply className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-50 to-pink-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">Flagged Reviews</p>
                <p className="text-2xl font-bold text-slate-900">{summary.flagged_count}</p>
                <div className="flex items-center gap-1 mt-1">
                  <EyeOff className="h-3 w-3 text-rose-500" />
                  <span className="text-xs text-slate-500">{summary.hidden_count} hidden</span>
                </div>
              </div>
              <div className="p-3 bg-rose-100 rounded-xl">
                <Flag className="h-6 w-6 text-rose-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rating Trends */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#082c59]" />
              Rating Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {trends && trends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(value) => value.slice(5)} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} domain={[0, 5]} />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="count" fill="#3B82F6" name="Reviews" />
                    <Line yAxisId="right" type="monotone" dataKey="average" stroke="#F59E0B" strokeWidth={2} name="Avg Rating" dot={{ fill: '#F59E0B' }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400">
                  No trend data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Distribution by Category */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChart className="h-5 w-5 text-[#082c59]" />
              Reviews by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {categoryPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={categoryPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {categoryPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RePieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400">
                  No category data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#082c59]" />
            Service Category Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-semibold text-slate-700">Category</th>
                  <th className="text-center py-3 px-2 font-semibold text-slate-700">Reviews</th>
                  <th className="text-center py-3 px-2 font-semibold text-slate-700">Avg Rating</th>
                  <th className="text-center py-3 px-2 font-semibold text-slate-700">Distribution</th>
                  <th className="text-center py-3 px-2 font-semibold text-slate-700">Response Rate</th>
                  <th className="text-center py-3 px-2 font-semibold text-slate-700">Flagged</th>
                </tr>
              </thead>
              <tbody>
                {by_category?.map((cat, i) => {
                  const Icon = SERVICE_ICONS[cat.category] || Package;
                  const color = SERVICE_COLORS[cat.category] || '#64748B';
                  return (
                    <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}15` }}>
                            <Icon className="h-4 w-4" style={{ color }} />
                          </div>
                          <span className="capitalize font-medium">{cat.category?.replace('_', ' ')}</span>
                        </div>
                      </td>
                      <td className="text-center py-3 px-2">{cat.count}</td>
                      <td className="text-center py-3 px-2">
                        <div className="flex items-center justify-center gap-1">
                          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                          <span className="font-medium">{cat.average}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center justify-center gap-1">
                          {[5, 4, 3, 2, 1].map(star => (
                            <div key={star} className="flex flex-col items-center">
                              <div 
                                className="w-4 rounded-t"
                                style={{ 
                                  height: `${Math.max(2, (cat.distribution?.[star] || 0) / cat.count * 40)}px`,
                                  backgroundColor: star >= 4 ? '#10B981' : star === 3 ? '#F59E0B' : '#EF4444'
                                }}
                              />
                              <span className="text-[9px] text-slate-400">{star}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="text-center py-3 px-2">
                        <Badge 
                          className={`${
                            cat.response_rate >= 80 ? 'bg-emerald-100 text-emerald-700' :
                            cat.response_rate >= 50 ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}
                        >
                          {cat.response_rate}%
                        </Badge>
                      </td>
                      <td className="text-center py-3 px-2">
                        {cat.flagged > 0 ? (
                          <Badge className="bg-rose-100 text-rose-700">
                            <Flag className="h-3 w-3 mr-1" />{cat.flagged}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Row: Top Operators & Flagged Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Operators by Response Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-[#082c59]" />
              Top Operators by Response Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            {top_operators && top_operators.length > 0 ? (
              <div className="space-y-3">
                {top_operators.map((op, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      i === 0 ? 'bg-amber-100 text-amber-600' :
                      i === 1 ? 'bg-slate-200 text-slate-600' :
                      i === 2 ? 'bg-orange-100 text-orange-600' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{op.name}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>{op.total} reviews</span>
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                          {op.avg_rating}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={`${
                        op.response_rate >= 80 ? 'bg-emerald-100 text-emerald-700' :
                        op.response_rate >= 50 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {op.response_rate}%
                      </Badge>
                      <p className="text-xs text-slate-400 mt-1">{op.responded}/{op.total} replied</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Users className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                <p>No operator data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Flagged Reviews Analysis */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Flagged Reviews Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {flagged_analysis?.by_category && flagged_analysis.by_category.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {flagged_analysis.by_category.map((cat, i) => {
                    const Icon = SERVICE_ICONS[cat.category] || Package;
                    const color = SERVICE_COLORS[cat.category] || '#64748B';
                    return (
                      <div key={i} className="p-3 bg-rose-50 rounded-lg border border-rose-100">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="h-4 w-4" style={{ color }} />
                          <span className="text-sm font-medium capitalize">{cat.category?.replace('_', ' ')}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge className="bg-rose-100 text-rose-700">
                            {cat.count} flagged
                          </Badge>
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Star className="h-3 w-3 text-amber-500" />
                            avg {cat.avg_rating}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="pt-3 border-t">
                  <p className="text-sm text-slate-600">
                    <strong>{summary.negative_percent}%</strong> of all reviews are negative (1-2 stars).
                    Categories with high flagged counts may need attention.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-emerald-600">
                <CheckCircle className="h-10 w-10 mx-auto mb-2" />
                <p className="font-medium">No flagged reviews!</p>
                <p className="text-sm text-slate-500 mt-1">All reviews are in good standing</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Moderation Queue Component
function ModerationQueueView() {
  const [queue, setQueue] = useState([]);
  const [counts, setCounts] = useState({ flagged: 0, hidden: 0, low_rating: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [processingAction, setProcessingAction] = useState(false);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await api.get('/ratings/moderation-queue', {
        params: { status_filter: filter, sort_by: sortBy, limit: 50 }
      });
      setQueue(res.data.queue || []);
      setCounts(res.data.counts || { flagged: 0, hidden: 0, low_rating: 0 });
    } catch {
      setQueue([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQueue(); }, [filter, sortBy]);

  const handleBulkAction = async (action) => {
    if (selectedIds.size === 0) return;
    setProcessingAction(true);
    try {
      await api.post('/ratings/bulk-moderate', {
        rating_ids: Array.from(selectedIds),
        action,
        reason: `Bulk ${action} from moderation queue`,
      });
      toast.success(`${selectedIds.size} rating(s) ${action}ed`);
      setSelectedIds(new Set());
      fetchQueue();
    } catch (err) {
      toast.error('Action failed');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleSingleAction = async (ratingId, action) => {
    try {
      await api.post(`/ratings/${ratingId}/moderate`, { action });
      toast.success(`Rating ${action}ed`);
      fetchQueue();
    } catch {
      toast.error('Action failed');
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = (checked) => {
    setSelectedIds(checked ? new Set(queue.map(q => q.id)) : new Set());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-[#082c59]" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="moderation-queue">
      {/* Queue Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className={`cursor-pointer transition-all ${filter === 'flagged' ? 'ring-2 ring-orange-400' : ''}`} onClick={() => setFilter(f => f === 'flagged' ? 'all' : 'flagged')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg"><Flag className="h-4 w-4 text-orange-600" /></div>
            <div>
              <p className="text-xl font-bold">{counts.flagged}</p>
              <p className="text-xs text-slate-500">Flagged</p>
            </div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer transition-all ${filter === 'hidden' ? 'ring-2 ring-slate-400' : ''}`} onClick={() => setFilter(f => f === 'hidden' ? 'all' : 'hidden')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg"><EyeOff className="h-4 w-4 text-slate-600" /></div>
            <div>
              <p className="text-xl font-bold">{counts.hidden}</p>
              <p className="text-xs text-slate-500">Hidden</p>
            </div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer transition-all ${filter === 'low' ? 'ring-2 ring-red-400' : ''}`} onClick={() => setFilter(f => f === 'low' ? 'all' : 'low')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg"><AlertTriangle className="h-4 w-4 text-red-600" /></div>
            <div>
              <p className="text-xl font-bold">{counts.low_rating}</p>
              <p className="text-xs text-slate-500">Low Rating (&le;2)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <Card className="bg-[#082c59] text-white border-0">
          <CardContent className="p-3 flex items-center justify-between">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <div className="flex gap-2">
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleBulkAction('unflag')} disabled={processingAction}>
                <CheckCircle className="h-3 w-3 mr-1" /> Approve
              </Button>
              <Button size="sm" className="bg-slate-500 hover:bg-slate-600 text-white" onClick={() => handleBulkAction('hide')} disabled={processingAction}>
                <EyeOff className="h-3 w-3 mr-1" /> Hide
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleBulkAction('delete')} disabled={processingAction}>
                <Trash2 className="h-3 w-3 mr-1" /> Delete
              </Button>
              <Button size="sm" variant="ghost" className="text-white hover:bg-white/20" onClick={() => setSelectedIds(new Set())}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sort controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox checked={queue.length > 0 && selectedIds.size === queue.length} onCheckedChange={selectAll} />
          <span className="text-sm text-slate-500">{queue.length} items in queue</span>
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="text-sm border rounded-lg px-3 py-1.5 bg-white">
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="lowest">Lowest Rating</option>
        </select>
      </div>

      {/* Queue Items */}
      {queue.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-300 mb-3" />
            <p className="font-semibold text-slate-700">Queue is clear</p>
            <p className="text-sm text-slate-500 mt-1">No items need moderation right now</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {queue.map((item) => (
            <Card key={item.id} className={`transition-all ${item.is_flagged ? 'border-l-4 border-l-orange-400' : item.is_hidden ? 'border-l-4 border-l-slate-400 opacity-70' : 'border-l-4 border-l-red-400'}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox checked={selectedIds.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{item.customer_name}</span>
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(s => <Star key={s} className={`h-3 w-3 ${s <= item.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />)}
                        </div>
                        {item.is_flagged && <Badge className="bg-orange-100 text-orange-700 text-[10px]"><Flag className="h-2.5 w-2.5 mr-0.5" />Flagged</Badge>}
                        {item.is_hidden && <Badge className="bg-slate-100 text-slate-600 text-[10px]"><EyeOff className="h-2.5 w-2.5 mr-0.5" />Hidden</Badge>}
                      </div>
                      <span className="text-[10px] text-slate-400">{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{item.service_name} · {item.service_category}</p>
                    {item.comment && <p className="text-sm text-slate-700 mt-1 line-clamp-2">{item.comment}</p>}
                    {item.flag_reason && <p className="text-xs text-orange-600 mt-1">Reason: {item.flag_reason}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      {item.is_flagged && (
                        <Button size="sm" variant="outline" className="h-7 text-xs text-green-600" onClick={() => handleSingleAction(item.id, 'unflag')}>
                          <CheckCircle className="h-3 w-3 mr-1" /> Approve
                        </Button>
                      )}
                      {!item.is_hidden ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs text-slate-600" onClick={() => handleSingleAction(item.id, 'hide')}>
                          <EyeOff className="h-3 w-3 mr-1" /> Hide
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 text-xs text-blue-600" onClick={() => handleSingleAction(item.id, 'unhide')}>
                          <Eye className="h-3 w-3 mr-1" /> Show
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" onClick={() => handleSingleAction(item.id, 'delete')}>
                        <Trash2 className="h-3 w-3 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Moderation Audit Log Component
function ModerationAuditView() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/ratings/moderation-audit?limit=50');
        setEntries(res.data.entries || []);
        setTotal(res.data.total || 0);
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const actionColors = {
    flag: 'text-orange-600 bg-orange-50',
    unflag: 'text-green-600 bg-green-50',
    hide: 'text-slate-600 bg-slate-100',
    unhide: 'text-blue-600 bg-blue-50',
    delete: 'text-red-600 bg-red-50',
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#082c59]" /></div>;
  }

  return (
    <div className="space-y-4" data-testid="moderation-audit">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{total} moderation action{total !== 1 ? 's' : ''} recorded</p>
        <Button variant="outline" size="sm" className="gap-1" onClick={async () => {
          try {
            const res = await api.get('/ratings/export');
            const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ratings_export_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('Export downloaded');
          } catch { toast.error('Export failed'); }
        }}>
          <FileText className="h-3 w-3" /> Export Ratings
        </Button>
      </div>

      {entries.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <ShieldAlert className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="font-semibold text-slate-700">No moderation history</p>
            <p className="text-sm text-slate-500 mt-1">Actions taken on ratings will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <Card key={i}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${actionColors[entry.action] || 'text-slate-600 bg-slate-50'}`}>
                  {entry.action}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{entry.performed_by_name}</span>
                    <span className="text-slate-500"> {entry.action === 'delete' ? 'deleted' : `${entry.action}ed`} a rating</span>
                    {entry.bulk && <Badge variant="outline" className="ml-2 text-[10px]">Bulk ({entry.batch_size})</Badge>}
                  </p>
                  {entry.reason && <p className="text-xs text-slate-500 mt-0.5">Reason: {entry.reason}</p>}
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {entry.created_at ? new Date(entry.created_at).toLocaleString() : ''}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Main Ratings Component
export default function Ratings() {
  const { user, isOperatorUser } = useAuth();
  const [activeTab, setActiveTab] = useState('ratings');
  const [searchParams] = useSearchParams();
  const [operatorFilter, setOperatorFilter] = useState('');
  
  const isOperator = user?.role === 'operator' || isOperatorUser;
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // Support deep linking via ?tab=messages
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'messages') setActiveTab('messages');
  }, [searchParams]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59]" data-testid="ratings-title">
            {isAdmin ? 'All Ratings' : isOperator ? 'Customer Reviews' : 'My Ratings & Reviews'}
          </h1>
          <p className="text-slate-600">
            {isAdmin
              ? 'View, moderate, and analyze ratings across the platform'
              : isOperator 
              ? 'Manage and respond to customer feedback for your services'
              : 'Reviews you\'ve left for services you\'ve used'}
          </p>
        </div>
        {isAdmin && (
          <OperatorScopeFilter value={operatorFilter} onChange={setOperatorFilter} />
        )}
      </div>

      {/* Admin View with Tabs */}
      {isAdmin ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 mb-6 bg-slate-100">
            <TabsTrigger 
              value="ratings" 
              className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white"
              data-testid="ratings-tab"
            >
              <MessageSquare className="h-4 w-4" />
              All Ratings
            </TabsTrigger>
            <TabsTrigger 
              value="queue" 
              className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white"
              data-testid="queue-tab"
            >
              <ShieldAlert className="h-4 w-4" />
              Queue
            </TabsTrigger>
            <TabsTrigger 
              value="audit" 
              className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white"
              data-testid="audit-tab"
            >
              <Activity className="h-4 w-4" />
              Audit Log
            </TabsTrigger>
            <TabsTrigger 
              value="reports" 
              className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white"
              data-testid="reports-tab"
            >
              <BarChart3 className="h-4 w-4" />
              Reports
            </TabsTrigger>
            <TabsTrigger 
              value="messages" 
              className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white"
              data-testid="admin-messages-tab"
            >
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ratings" className="mt-6">
            <AdminRatingsView />
          </TabsContent>

          <TabsContent value="queue" className="mt-6">
            <ModerationQueueView />
          </TabsContent>

          <TabsContent value="audit" className="mt-6">
            <ModerationAuditView />
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <AdminReportsView />
          </TabsContent>

          <TabsContent value="messages" className="mt-6">
            <MessagesTab
              key={`${searchParams.get('subtab') || 'alerts'}-${searchParams.get('id') || ''}`}
              highlightId={searchParams.get('id')}
              initialSubTab={searchParams.get('subtab')}
            />
          </TabsContent>
        </Tabs>
      ) : isOperator ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-100">
            <TabsTrigger value="ratings" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white" data-testid="operator-reviews-tab">
              <Star className="h-4 w-4" /> Customer Reviews
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white" data-testid="operator-messages-tab">
              <Bell className="h-4 w-4" /> Notifications
            </TabsTrigger>
          </TabsList>
          <TabsContent value="ratings" className="mt-6">
            <OperatorRatingsView />
          </TabsContent>
          <TabsContent value="messages" className="mt-6">
            <MessagesTab
              key={`${searchParams.get('subtab') || 'alerts'}-${searchParams.get('id') || ''}`}
              highlightId={searchParams.get('id')}
              initialSubTab={searchParams.get('subtab')}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-100">
            <TabsTrigger value="ratings" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white" data-testid="my-reviews-tab">
              <Star className="h-4 w-4" /> My Reviews
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white" data-testid="ratings-messages-tab">
              <MessageSquare className="h-4 w-4" /> Messages
            </TabsTrigger>
          </TabsList>
          <TabsContent value="ratings" className="mt-6">
            <CustomerRatingsView />
          </TabsContent>
          <TabsContent value="messages" className="mt-6">
            <MessagesTab
              key={`${searchParams.get('subtab') || 'alerts'}-${searchParams.get('id') || ''}`}
              highlightId={searchParams.get('id')}
              initialSubTab={searchParams.get('subtab')}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
