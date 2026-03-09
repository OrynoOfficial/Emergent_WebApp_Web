import { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { Send, Loader2, ImagePlus, X } from 'lucide-react';
import api from '../api/client';

export default function TicketReplyBox({ ticketId, onReplySent, showInternalToggle = false }) {
  const [text, setText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [sending, setSending] = useState(false);
  const fileRef = useRef(null);

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files || []);
    const valid = selected.filter(f => f.type === 'image/jpeg' || f.type === 'image/png');
    if (valid.length !== selected.length) {
      alert('Only JPEG and PNG images are allowed');
    }
    const combined = [...files, ...valid].slice(0, 5); // max 5 images
    setFiles(combined);
    setPreviews(combined.map(f => URL.createObjectURL(f)));
    e.target.value = '';
  };

  const removeFile = (idx) => {
    URL.revokeObjectURL(previews[idx]);
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSend = async () => {
    if (!text.trim() && files.length === 0) return;
    setSending(true);
    try {
      if (files.length > 0) {
        const formData = new FormData();
        formData.append('message', text);
        formData.append('is_internal', isInternal.toString());
        files.forEach(f => formData.append('files', f));
        await api.post(`/support-tickets/${ticketId}/reply-with-attachments`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await api.post(`/support-tickets/${ticketId}/reply`, { message: text, is_internal: isInternal });
      }
      setText('');
      setFiles([]);
      previews.forEach(p => URL.revokeObjectURL(p));
      setPreviews([]);
      setIsInternal(false);
      if (onReplySent) onReplySent();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t border-slate-200/60 bg-white/40 flex-shrink-0">
      {/* Image previews */}
      {previews.length > 0 && (
        <div className="px-4 pt-3 flex gap-2 flex-wrap">
          {previews.map((src, i) => (
            <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 shadow-sm group">
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button onClick={() => removeFile(i)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="p-4">
        {showInternalToggle && (
          <div className="flex items-center gap-2 mb-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <Checkbox checked={isInternal} onCheckedChange={setIsInternal} />
              <span className={isInternal ? 'text-amber-600 font-medium' : 'text-slate-500'}>{isInternal ? 'Internal Note' : 'Public Reply'}</span>
            </label>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={isInternal ? "Internal note..." : "Type your reply..."} rows={2} className="resize-none bg-white/70 pr-10" />
            <button onClick={() => fileRef.current?.click()} className="absolute right-2 bottom-2 p-1.5 rounded-lg text-slate-400 hover:text-[#082c59] hover:bg-[#082c59]/5 transition-colors" title="Attach image (JPEG/PNG)">
              <ImagePlus className="w-4 h-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" multiple className="hidden" onChange={handleFileSelect} />
          </div>
          <Button onClick={handleSend} disabled={sending || (!text.trim() && files.length === 0)} className="bg-[#082c59] hover:bg-[#0a3a75]">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        {files.length > 0 && <p className="text-[10px] text-slate-400 mt-1">{files.length} image{files.length > 1 ? 's' : ''} attached (max 5)</p>}
      </div>
    </div>
  );
}
