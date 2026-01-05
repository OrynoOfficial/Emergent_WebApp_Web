import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  QrCode, Camera, CheckCircle, XCircle, RefreshCw,
  Ticket, User, Calendar, MapPin, AlertCircle
} from 'lucide-react';
import { formatFCFA } from '@/utils/currency';

export default function Scanner() {
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleManualSubmit = () => {
    if (!manualCode.trim()) return;
    
    setError(null);
    
    // Simulate scan result
    if (manualCode.startsWith('TKT-') || manualCode.startsWith('BK-')) {
      setResult({
        valid: true,
        code: manualCode,
        type: 'travel',
        customer: {
          name: 'Jean Mbarga',
          email: 'jean@example.com',
          phone: '+237 699 111 222'
        },
        booking: {
          service: 'Express Voyage',
          route: 'Yaounde - Douala',
          date: '2025-12-22',
          time: '15:00',
          seat: 'A12',
          amount: 6500
        }
      });
    } else {
      setResult({
        valid: false,
        code: manualCode,
        message: 'Invalid code format. Expected TKT-XXXX or BK-XXXX'
      });
    }
  };

  const handleStartScanner = () => {
    setScanning(true);
    setResult(null);
    setError(null);
    
    // Simulate scanner - in production, use a QR scanner library
    setTimeout(() => {
      setScanning(false);
      setError('Camera access not available. Please use manual entry.');
    }, 3000);
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setManualCode('');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#082c59] rounded-full flex items-center justify-center mx-auto mb-4">
            <QrCode className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#082c59]">Ticket Scanner</h1>
          <p className="text-gray-600">Scan QR codes or enter ticket codes manually</p>
        </div>

        {!result ? (
          <div className="space-y-6">
            {/* Scanner Area */}
            <Card>
              <CardContent className="p-6">
                <div className="aspect-square max-h-80 bg-slate-900 rounded-lg flex flex-col items-center justify-center relative overflow-hidden">
                  {scanning ? (
                    <>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-48 h-48 border-2 border-white/50 rounded-lg">
                          <div className="absolute top-0 left-0 right-0 h-0.5 bg-green-500 animate-pulse" style={{ animation: 'scan 2s ease-in-out infinite' }} />
                        </div>
                      </div>
                      <RefreshCw className="w-8 h-8 text-white animate-spin" />
                      <p className="text-white mt-4">Scanning...</p>
                    </>
                  ) : (
                    <>
                      <Camera className="w-16 h-16 text-slate-600 mb-4" />
                      <p className="text-slate-400 mb-4">Camera preview will appear here</p>
                      <Button onClick={handleStartScanner} className="bg-white text-slate-900 hover:bg-gray-100">
                        <Camera className="w-4 h-4 mr-2" /> Start Scanner
                      </Button>
                    </>
                  )}
                </div>
                {error && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2 text-yellow-800">
                    <AlertCircle className="w-5 h-5" />
                    <span>{error}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Manual Entry */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Manual Entry</h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter ticket code (TKT-XXXX or BK-XXXX)"
                    className="font-mono"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                    onKeyPress={(e) => e.key === 'Enter' && handleManualSubmit()}
                  />
                  <Button onClick={handleManualSubmit} className="bg-[#082c59]">
                    Verify
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="p-6">
              {result.valid ? (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-green-600">Valid Ticket</h2>
                    <p className="font-mono text-gray-500">{result.code}</p>
                  </div>

                  <div className="border-t pt-6 space-y-4">
                    <div className="flex items-start gap-3">
                      <User className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="font-semibold">{result.customer.name}</p>
                        <p className="text-sm text-gray-500">{result.customer.email}</p>
                        <p className="text-sm text-gray-500">{result.customer.phone}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Ticket className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="font-semibold">{result.booking.service}</p>
                        <p className="text-sm text-gray-500">{result.booking.route}</p>
                        <Badge variant="outline" className="mt-1">Seat {result.booking.seat}</Badge>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="font-semibold">{result.booking.date}</p>
                        <p className="text-sm text-gray-500">Departure: {result.booking.time}</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Amount Paid</span>
                        <span className="text-xl font-bold text-[#082c59]">{formatFCFA(result.booking.amount)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button className="flex-1 bg-green-600 hover:bg-green-700">
                      <CheckCircle className="w-4 h-4 mr-2" /> Confirm Entry
                    </Button>
                    <Button variant="outline" onClick={handleReset}>
                      Scan Another
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                    <XCircle className="w-10 h-10 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-red-600">Invalid Ticket</h2>
                    <p className="font-mono text-gray-500">{result.code}</p>
                    <p className="text-gray-600 mt-2">{result.message}</p>
                  </div>
                  <Button onClick={handleReset} className="bg-[#082c59]">
                    Try Again
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
