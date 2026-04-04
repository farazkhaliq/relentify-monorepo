'use client'
import { useState, useRef } from 'react'
import { Camera, Trash2, Plus, X, Sparkles, CheckCircle2 } from 'lucide-react'
import { 
  Button, 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent,
  Badge,
  Input,
  Label
} from '@relentify/ui'
import { usePhotoManager } from '@/hooks/usePhotoManager'

const DEFAULT_ROOMS = [
  'Living Room', 'Kitchen', 'Bedroom 1', 'Bedroom 2', 'Bedroom 3',
  'Bathroom', 'En-Suite', 'Hallway', 'Stairs', 'Landing', 'Garden', 'Garage'
]
const CONDITIONS = ['Good', 'Fair', 'Poor']

type Photo = {
  id: string
  room: string
  condition: string
  description: string | null
  imageData: string | null
  uploadedAt: string
}

type Props = {
  inventoryId: string
  initialPhotos: Photo[]
}

export default function PhotoManager({ inventoryId, initialPhotos }: Props) {
  const {
    photos,
    rooms,
    activeRoom,
    setActiveRoom,
    uploading,
    error,
    setError,
    deletingId,
    savedAt,
    addRoom,
    uploadPhotos,
    deletePhoto,
  } = usePhotoManager(inventoryId, initialPhotos)

  const [showAddRoom, setShowAddRoom] = useState(false)
  const [newRoomInput, setNewRoomInput] = useState('')
  const [showRoomPicker, setShowRoomPicker] = useState(false)
  const [condition, setCondition] = useState('Good')
  const [description, setDescription] = useState('')
  const [showUploadPanel, setShowUploadPanel] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const roomPhotos = activeRoom ? photos.filter(p => p.room === activeRoom) : []

  const handleAddRoom = (room: string) => {
    addRoom(room)
    setShowRoomPicker(false)
    setShowAddRoom(false)
    setNewRoomInput('')
    setShowUploadPanel(true)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length || !activeRoom) return
    await uploadPhotos(files, activeRoom, condition, description)
    setDescription('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-8">
      {/* Room Tabs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--theme-border)]">
          <div>
            <CardTitle className="text-lg">Location Matrix</CardTitle>
            <CardDescription>Select asset containment area</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRoomPicker(true)}
            className="rounded-xl font-mono text-[var(--theme-text-10)] uppercase tracking-widest border border-[var(--theme-border)]"
          >
            <Plus size={14} className="mr-2" /> Add Zone
          </Button>
        </CardHeader>

        {rooms.length === 0 ? (
          <CardContent className="py-20 text-center">
            <Camera size={48} className="mx-auto mb-4 text-[var(--theme-text-dim)]/50" />
            <div className="text-[var(--theme-text-dim)] font-mono text-[var(--theme-text-75)] uppercase tracking-widest mb-8">No active zones detected</div>
            <Button
              variant="primary"
              onClick={() => setShowRoomPicker(true)}
              className="shadow-xl shadow-[var(--theme-accent)]/20"
            >
              Initialise First Zone
            </Button>
          </CardContent>
        ) : (
          <CardContent className="pt-8">
            <div className="flex flex-wrap gap-3">
              {rooms.map(room => {
                const count = photos.filter(p => p.room === room).length
                const isActive = activeRoom === room
                return (
                  <button
                    key={room}
                    onClick={() => { setActiveRoom(isActive ? null : room); setShowUploadPanel(false) }}
                    className={`group flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all duration-500 magnetic-btn ${
                      isActive
                        ? 'bg-[var(--theme-accent)] border-[var(--theme-accent)] text-[var(--theme-text)] shadow-lg shadow-[var(--theme-accent)]/20'
                        : 'bg-[var(--theme-border)] border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:border-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                    }`}
                  >
                    <span className="font-bold text-[var(--theme-text-85)] tracking-tight">{room}</span>
                    <span className={`text-[var(--theme-text-10)] font-mono px-2 py-0.5 rounded-full font-bold ${
                      isActive ? 'bg-[var(--theme-text)]/20 text-[var(--theme-text)]' : 'bg-[var(--theme-text)]/10 text-[var(--theme-text-dim)]'
                    }`}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {showRoomPicker && (
        <div className="fixed inset-0 glass-panel z-50 flex items-center justify-center p-6 animate-in fade-in duration-500">
          <Card className="w-full max-w-lg shadow-cinematic">
            <CardHeader className="flex-row items-center justify-between border-b border-[var(--theme-border)]">
              <div>
                <CardTitle>Zone Registry</CardTitle>
                <CardDescription>Initialise new assessment area</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setShowRoomPicker(false); setShowAddRoom(false); setNewRoomInput('') }} className="w-10 h-10 p-0 rounded-full">
                <X size={20} />
              </Button>
            </CardHeader>
            <CardContent className="pt-8 space-y-8">
              <div className="grid grid-cols-2 gap-3">
                {DEFAULT_ROOMS.filter(r => !rooms.includes(r)).map(room => (
                  <Button
                    key={room}
                    variant="ghost"
                    onClick={() => handleAddRoom(room)}
                    className="justify-start h-12 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-border)] text-[var(--theme-text-75)] font-bold tracking-tight hover:border-[var(--theme-accent)]/50 hover:text-[var(--theme-accent)]"
                  >
                    {room}
                  </Button>
                ))}
              </div>
              
              <div className="pt-4 border-t border-[var(--theme-border)]">
                {!showAddRoom ? (
                  <Button
                    variant="outline"
                    onClick={() => setShowAddRoom(true)}
                    className="w-full h-12 border-dashed rounded-xl font-mono text-[var(--theme-text-10)] uppercase tracking-widest"
                  >
                    <Plus size={14} className="mr-2" /> Custom Identification
                  </Button>
                ) : (
                  <div className="flex gap-3">
                    <Input
                      placeholder="Enter custom zone name"
                      value={newRoomInput}
                      onChange={e => setNewRoomInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddRoom(newRoomInput)}
                      autoFocus
                      className="bg-[var(--theme-border)]"
                    />
                    <Button
                      variant="primary"
                      onClick={() => handleAddRoom(newRoomInput)}
                      className="px-8 h-12 rounded-xl"
                    >
                      Add
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Room Panel */}
      {activeRoom && (
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--theme-border)]">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-xl font-bold text-[var(--theme-text)] tracking-tight">{activeRoom}</h3>
                {savedAt && (
                  <Badge variant="success" className="animate-in fade-in zoom-in duration-1000">
                    <CheckCircle2 size={10} className="mr-1" /> Synced
                  </Badge>
                )}
              </div>
              <CardDescription>{roomPhotos.length} Object Captures</CardDescription>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowUploadPanel(!showUploadPanel)}
              className="rounded-xl shadow-lg shadow-[var(--theme-accent)]/20 h-11 px-6"
            >
              <Camera size={16} className="mr-2" /> Capture
            </Button>
          </CardHeader>

          {showUploadPanel && (
            <CardContent className="bg-[var(--theme-accent)]/5 border-b border-[var(--theme-border)] p-8 space-y-8 animate-in slide-in-from-top-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                <div className="space-y-3">
                  <Label>Asset Integrity</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {CONDITIONS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCondition(c)}
                        className={`py-3 rounded-xl text-[var(--theme-text-10)] font-mono font-bold uppercase tracking-widest border-2 transition-all duration-500 magnetic-btn ${
                          condition === c 
                            ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]' 
                            : 'border-[var(--theme-border)] bg-[var(--theme-border)] text-[var(--theme-text-dim)] hover:border-[var(--theme-text-muted)]'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>Observation Note</Label>
                  <Input
                    placeholder="e.g. Surface level anomaly"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="bg-[var(--theme-border)] border-[var(--theme-border)]"
                  />
                </div>
              </div>
              
              <div className="flex gap-4">
                <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple onChange={handleFileChange} className="hidden" />
                <Button
                  variant="primary"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex-1 h-14 rounded-2xl shadow-xl shadow-[var(--theme-accent)]/20"
                >
                  {uploading ? <><span className="animate-spin mr-3">⟳</span> Uploading Sequence...</> : <><Sparkles size={18} className="mr-3" /> Execute Capture</>}
                </Button>
                <Button variant="ghost" onClick={() => setShowUploadPanel(false)} className="w-14 h-14 p-0 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-border)]">
                  <X size={20} />
                </Button>
              </div>
              {error && (
                <div className="p-4 rounded-xl bg-[var(--theme-destructive)]/10 border border-[var(--theme-destructive)]/20 text-[var(--theme-destructive)] text-[var(--theme-text-10)] font-mono font-bold uppercase tracking-widest flex items-center justify-between">
                  {error} <X size={14} className="cursor-pointer" onClick={() => setError('')} />
                </div>
              )}
            </CardContent>
          )}

          <CardContent className="pt-8">
            {roomPhotos.length === 0 ? (
              <div className="py-20 text-center opacity-20">
                <Camera size={32} className="mx-auto mb-3" />
                <div className="text-[var(--theme-text-10)] font-mono uppercase tracking-widest font-bold">No visual data recorded</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {roomPhotos.map(photo => (
                  <div key={photo.id} className="group relative rounded-2xl overflow-hidden border border-[var(--theme-border)] bg-[var(--theme-border)] transition-all duration-500 hover:scale-[1.05] hover:z-10 shadow-cinematic hover:shadow-[var(--theme-accent)]/10">
                    <div className="aspect-[4/3] relative">
                      <img
                        src={photo.imageData || ''}
                        alt={photo.description || activeRoom}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[var(--theme-background)]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant={
                          photo.condition === 'Good' ? 'success' : 
                          photo.condition === 'Fair' ? 'warning' : 
                          'destructive'
                        }>
                          {photo.condition}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deletePhoto(photo.id)}
                          disabled={deletingId === photo.id}
                          className="w-8 h-8 p-0 rounded-lg text-[var(--theme-text-dim)] hover:text-[var(--theme-destructive)] hover:bg-[var(--theme-destructive)]/10 transition-colors"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                      {photo.description && (
                        <p className="text-[var(--theme-text-10)] text-[var(--theme-text-muted)] font-medium leading-relaxed line-clamp-2 italic">
                          &ldquo;{photo.description}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!activeRoom && rooms.length > 0 && (
        <div className="p-12 text-center rounded-cinematic border-2 border-dashed border-[var(--theme-border)]">
          <div className="text-[var(--theme-text-10)] font-mono font-bold uppercase tracking-[0.3em] text-[var(--theme-text-dim)]">Select operation zone from matrix</div>
        </div>
      )}
    </div>
  )
}
