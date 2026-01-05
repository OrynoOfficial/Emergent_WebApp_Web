import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Armchair, X, DoorOpen, Trash2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const LAYOUT_PRESETS = {
  '2-2': { rows: 10, columns: 4, name: 'Standard 2-2 (40 seats)' },
  '2-3': { rows: 10, columns: 5, name: 'Wide 2-3 (50 seats)' },
  'custom': { rows: 12, columns: 4, name: 'Custom Layout' }
};

export default function SeatLayoutEditor({ 
  initialLayout = null, 
  onSave,
  onCancel 
}) {
  const [layoutType, setLayoutType] = useState(initialLayout?.layout_type || '2-2');
  const [rows, setRows] = useState(initialLayout?.rows || 10);
  const [columns, setColumns] = useState(initialLayout?.columns || 4);
  const [driverPosition, setDriverPosition] = useState(initialLayout?.driver_position || 'left');
  const [seatNumbering, setSeatNumbering] = useState(initialLayout?.seat_numbering || 'sequential');
  const [specialPositions, setSpecialPositions] = useState(initialLayout?.special_positions || []);

  // Apply preset
  const applyPreset = (preset) => {
    setLayoutType(preset);
    const config = LAYOUT_PRESETS[preset];
    setRows(config.rows);
    setColumns(config.columns);
    setSpecialPositions([]);
  };

  // Toggle special position
  const toggleSpecialPosition = (row, col, type) => {
    setSpecialPositions(prev => {
      const exists = prev.find(p => p.row === row && p.column === col);
      
      if (exists) {
        if (exists.type === type) {
          return prev.filter(p => !(p.row === row && p.column === col));
        } else {
          return prev.map(p => 
            p.row === row && p.column === col 
              ? { ...p, type } 
              : p
          );
        }
      } else {
        return [...prev, { row, column: col, type }];
      }
    });
  };

  // Calculate total seats
  const calculateTotalSeats = () => {
    const totalCells = rows * columns;
    const specialCount = specialPositions.length;
    return totalCells - specialCount;
  };

  // Generate preview seat numbers
  const generateSeatNumbers = () => {
    const seats = [];
    let counter = 1;
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const isSpecial = specialPositions.find(p => p.row === r && p.column === c);
        
        if (!isSpecial) {
          if (seatNumbering === 'sequential') {
            seats.push({ row: r, col: c, number: counter.toString() });
          } else {
            const rowNum = r + 1;
            const colLetter = String.fromCharCode(65 + c);
            seats.push({ row: r, col: c, number: `${rowNum}${colLetter}` });
          }
          counter++;
        }
      }
    }
    
    return seats;
  };

  const handleSave = () => {
    const layout = {
      rows,
      columns,
      layout_type: layoutType,
      driver_position: driverPosition,
      special_positions: specialPositions,
      seat_numbering: seatNumbering,
      total_seats: calculateTotalSeats()
    };
    
    onSave(layout);
  };

  const seatNumbers = generateSeatNumbers();
  const totalSeats = calculateTotalSeats();

  return (
    <div className="space-y-6">
      {/* Configuration Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Seat Layout Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preset Selection */}
          <div>
            <Label>Layout Preset</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {Object.entries(LAYOUT_PRESETS).map(([key, config]) => (
                <Button
                  key={key}
                  variant={layoutType === key ? 'default' : 'outline'}
                  onClick={() => applyPreset(key)}
                  className={cn(
                    "flex flex-col h-auto py-3",
                    layoutType === key && "bg-[#082c59]"
                  )}
                >
                  <span className="font-semibold">{key}</span>
                  <span className="text-xs opacity-75">{config.name}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Dimensions */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="rows">Rows</Label>
              <Input
                id="rows"
                type="number"
                min="1"
                max="20"
                value={rows}
                onChange={(e) => setRows(parseInt(e.target.value) || 1)}
                className="bg-white"
              />
            </div>
            <div>
              <Label htmlFor="columns">Columns</Label>
              <Input
                id="columns"
                type="number"
                min="2"
                max="6"
                value={columns}
                onChange={(e) => setColumns(parseInt(e.target.value) || 2)}
                className="bg-white"
              />
            </div>
          </div>

          {/* Additional Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Driver Position</Label>
              <Select value={driverPosition} onValueChange={setDriverPosition}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="left">Left Side</SelectItem>
                  <SelectItem value="right">Right Side</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Seat Numbering</Label>
              <Select value={seatNumbering} onValueChange={setSeatNumbering}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="sequential">Sequential (1, 2, 3...)</SelectItem>
                  <SelectItem value="row-column">Row-Column (1A, 1B...)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Total Seats Display */}
          <div className="bg-[#082c59]/10 border border-[#082c59]/20 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#082c59]" />
              <span className="font-semibold text-[#082c59]">Total Bookable Seats:</span>
            </div>
            <Badge className="bg-[#082c59] text-white text-lg px-4 py-1">
              {totalSeats}
            </Badge>
          </div>

          {/* Special Position Tools */}
          <div>
            <Label>Mark Special Positions (click on seat preview below)</Label>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="cursor-help">
                <DoorOpen className="h-3 w-3 mr-1" /> Door
              </Badge>
              <Badge variant="outline" className="cursor-help">
                <Trash2 className="h-3 w-3 mr-1" /> Toilet
              </Badge>
              <Badge variant="outline" className="cursor-help">
                <X className="h-3 w-3 mr-1" /> Empty/Aisle
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visual Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Seat Layout Preview</span>
            <span className="text-sm font-normal text-slate-500">
              Click seats to mark as special positions
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-100 p-6 rounded-xl">
            {/* Driver */}
            <div className="bg-slate-300 h-12 rounded-t-full mb-6 flex items-center justify-center">
              <span className="text-sm font-medium text-slate-700">🚗 Driver ({driverPosition})</span>
            </div>

            {/* Seat Grid */}
            <div className="max-w-2xl mx-auto">
              <div 
                className="grid gap-2" 
                style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
              >
                {Array.from({ length: rows * columns }, (_, i) => {
                  const row = Math.floor(i / columns);
                  const col = i % columns;
                  const special = specialPositions.find(p => p.row === row && p.column === col);
                  const seatInfo = seatNumbers.find(s => s.row === row && s.col === col);
                  
                  return (
                    <div key={i} className="relative group">
                      <button
                        type="button"
                        onClick={() => {
                          if (!special) {
                            toggleSpecialPosition(row, col, 'door');
                          } else if (special.type === 'door') {
                            toggleSpecialPosition(row, col, 'toilet');
                          } else if (special.type === 'toilet') {
                            toggleSpecialPosition(row, col, 'empty');
                          } else {
                            toggleSpecialPosition(row, col, 'door');
                          }
                        }}
                        className={cn(
                          'h-14 w-full rounded-lg border-2 flex flex-col items-center justify-center transition-all text-xs font-medium',
                          special 
                            ? special.type === 'door' 
                              ? 'bg-yellow-100 border-yellow-400 text-yellow-700 hover:bg-yellow-200'
                              : special.type === 'toilet'
                              ? 'bg-purple-100 border-purple-400 text-purple-700 hover:bg-purple-200'
                              : 'bg-slate-200 border-slate-400 text-slate-500 hover:bg-slate-300'
                            : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400'
                        )}
                      >
                        {special ? (
                          <>
                            {special.type === 'door' && <DoorOpen className="h-4 w-4" />}
                            {special.type === 'toilet' && <Trash2 className="h-4 w-4" />}
                            {special.type === 'empty' && <X className="h-4 w-4" />}
                            <span className="text-[9px] mt-1">{special.type}</span>
                          </>
                        ) : (
                          <>
                            <Armchair className="h-4 w-4" />
                            <span className="text-[10px] mt-1 font-bold">
                              {seatInfo?.number || `${row}-${col}`}
                            </span>
                          </>
                        )}
                      </button>
                      
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-800 text-white text-xs py-1 px-2 rounded whitespace-nowrap z-10">
                        Row {row + 1}, Col {col + 1}
                        {seatInfo && ` • Seat ${seatInfo.number}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mt-6 pt-4 border-t">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 bg-emerald-50 border-emerald-300 flex items-center justify-center">
                  <Armchair className="w-3 h-3 text-emerald-600" />
                </div>
                <span>Regular Seat</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 bg-yellow-100 border-yellow-400 flex items-center justify-center">
                  <DoorOpen className="w-3 h-3 text-yellow-700" />
                </div>
                <span>Door</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 bg-purple-100 border-purple-400 flex items-center justify-center">
                  <Trash2 className="w-3 h-3 text-purple-700" />
                </div>
                <span>Toilet</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border-2 bg-slate-200 border-slate-400 flex items-center justify-center">
                  <X className="w-3 h-3 text-slate-600" />
                </div>
                <span>Empty/Aisle</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button onClick={handleSave} className="bg-[#082c59] hover:bg-[#0a3a75]">
          Save Layout ({totalSeats} seats)
        </Button>
      </div>
    </div>
  );
}
