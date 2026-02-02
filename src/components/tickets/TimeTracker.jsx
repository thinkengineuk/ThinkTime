import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Play, Pause, X, Edit2, Check, Clock } from "lucide-react";
import { format } from "date-fns";

export default function TimeTracker({ 
  onSubmit, 
  ticketId, 
  isAgent = false,
  onTimerEnd 
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedMinutes, setEditedMinutes] = useState(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  const handleStart = () => {
    setStartTime(Date.now());
    setIsRunning(true);
    setIsEditing(false);
  };

  const handleStop = () => {
    setIsRunning(false);
    const minutes = Math.max(15, Math.round(elapsed / 60));
    setEditedMinutes(minutes);
  };

  const handleReset = () => {
    setIsRunning(false);
    setStartTime(null);
    setElapsed(0);
    setEditedMinutes(null);
    setNotes("");
    setIsEditing(false);
  };

  const handleSave = async () => {
    await onSubmit({
      ticket_id: ticketId,
      start_time: new Date(Date.now() - elapsed * 1000),
      end_time: new Date(),
      suggested_minutes: Math.max(15, Math.round(elapsed / 60)),
      actual_minutes: editedMinutes,
      is_manually_edited: editedMinutes !== Math.max(15, Math.round(elapsed / 60)),
      edit_reason: isEditing ? notes : null,
      notes: notes
    });
    handleReset();
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (!isAgent) return null;

  return (
    <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200/50 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-slate-900">Time Tracking</h3>
        </div>
      </div>

      {!startTime ? (
        <Button onClick={handleStart} className="w-full bg-green-600 hover:bg-green-700">
          <Play className="w-4 h-4 mr-2" />
          Start Timer
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-4xl font-mono font-bold text-blue-600">
              {formatTime(elapsed)}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {isRunning ? "Timer running..." : "Timer paused"}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => setIsRunning(!isRunning)}
              variant="outline"
              className="flex-1"
            >
              {isRunning ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </>
              )}
            </Button>
            <Button onClick={handleStop} className="flex-1 bg-orange-600 hover:bg-orange-700">
              Stop & Save
            </Button>
            <Button
              onClick={handleReset}
              variant="ghost"
              size="icon"
              className="text-red-600 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {editedMinutes !== null && (
        <div className="mt-6 pt-6 border-t border-blue-200 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Suggested Time
              </label>
              <div className="text-lg font-semibold text-slate-900">
                {Math.max(15, Math.round(elapsed / 60))} min
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Actual Time
              </label>
              {isEditing ? (
                <Input
                  type="number"
                  min="1"
                  value={editedMinutes}
                  onChange={(e) => setEditedMinutes(parseInt(e.target.value) || 0)}
                  className="text-lg font-semibold"
                />
              ) : (
                <div className="text-lg font-semibold text-slate-900">
                  {editedMinutes} min
                  <button
                    onClick={() => setIsEditing(true)}
                    className="ml-2 text-blue-600 hover:text-blue-700"
                  >
                    <Edit2 className="w-3 h-3 inline" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {editedMinutes !== Math.max(15, Math.round(elapsed / 60)) && (
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-2">
                Reason for Change
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Why was the time adjusted?"
                rows={2}
                className="text-sm"
              />
            </div>
          )}

          {editedMinutes === Math.max(15, Math.round(elapsed / 60)) && (
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-2">
                Notes (optional)
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about the work performed..."
                rows={2}
                className="text-sm"
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700">
              <Check className="w-4 h-4 mr-2" />
              Save Time Entry
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}