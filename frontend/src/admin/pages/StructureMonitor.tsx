import { useState, useEffect, useRef } from 'react'
import { Camera, Upload, FileVideo, FileImage, CheckCircle2, AlertTriangle, Loader2, Hammer, HardHat } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
// import { Badge } from '@/shared/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert'
import { Button } from '@/shared/components/ui/button'
// import { Progress } from '@/shared/components/ui/progress'
import { cn } from '@/shared/lib/utils'
import api from '@/shared/lib/api'

interface StructureResult {
    type: 'image' | 'video'
    score: number
    status: string
    detections: string[]
    processed_file: string
    stats?: {
        total_frames: number
        frames_with_detection: number
        effective_time_percent: number
    }
    error?: string
    timestamp?: string
    originalUrl?: string
    processedUrl?: string
    explanation?: string
}

const StructureMonitor = () => {
    const [status, setStatus] = useState<StructureResult | null>(null)
    const [uploading, setUploading] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const pollingIntervalRef = useRef<number | null>(null)

    const [processing, setProcessing] = useState(false)
    const [localPreview, setLocalPreview] = useState<string | null>(null)

    // Función para obtener el estado
    const fetchStatus = async () => {
        try {
            // console.log('Fetching structure status...')
            const response = await api.get('/v1/structure/status')
            // console.log('Structure status response:', response.data)
            if (response.data.success) {
                if (response.data.processing) {
                    setProcessing(true)
                } else {
                    setProcessing(false)
                    setStatus(response.data.status)
                    // Si ya terminó, limpiamos el preview local
                    if (response.data.status) {
                        setLocalPreview(null)
                    }
                }
            }
            setError(null)
        } catch (err: any) {
            console.error('Error al obtener estado Structure:', err)
            // No mostrar error si es solo polling, a menos que sea crítico
        } finally {
            setLoading(false)
        }
    }

    // Polling
    useEffect(() => {
        fetchStatus()
        pollingIntervalRef.current = window.setInterval(fetchStatus, 2000)
        return () => {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
        }
    }, [])

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0]

            // Crear preview local
            const objectUrl = URL.createObjectURL(file)
            setLocalPreview(objectUrl)
            setStatus(null) // Limpiar estado anterior visualmente

            await uploadFile(file)
        }
    }

    const uploadFile = async (file: File) => {
        setUploading(true)
        setError(null)

        const formData = new FormData()
        formData.append('file', file)

        try {
            await api.post('/v1/structure/analyze', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            })
            // Forzar actualización inmediata
            setTimeout(fetchStatus, 1000)
        } catch (err: any) {
            console.error('Error al subir archivo:', err)
            setError(err.response?.data?.error || 'Error al subir archivo')
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const getProgressColor = (score: number) => {
        if (score < 20) return 'bg-red-500'
        if (score < 50) return 'bg-orange-500'
        if (score < 80) return 'bg-yellow-500'
        return 'bg-green-500'
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Hammer className="h-8 w-8 text-primary" />
                        Avance de obra
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Análisis de avance de obra y estructuras
                    </p>
                </div>
                <div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*,video/*"
                        onChange={handleFileSelect}
                    />
                    <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="gap-2"
                    >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Subir Imagen o Video
                    </Button>
                    {status && (
                        <Button
                            variant="outline"
                            onClick={async () => {
                                setStatus(null)
                                if (fileInputRef.current) fileInputRef.current.value = ''
                                try {
                                    await api.post('/v1/structure/reset')
                                } catch (e) {
                                    console.error('Error resetting status:', e)
                                }
                            }}
                            className="gap-2"
                        >
                            <Loader2 className="h-4 w-4 opacity-0" /> {/* Spacer to match height if needed, or just use icon */}
                            Limpiar
                        </Button>
                    )}
                </div>
            </div>

            {/* Grid principal */}
            <div className="grid gap-6 md:grid-cols-3">
                {/* Visualizador - Ocupa 2 columnas */}
                <Card className="md:col-span-2 border-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            {status?.type === 'video' ? <FileVideo className="h-5 w-5" /> : <FileImage className="h-5 w-5" />}
                            Visualización
                        </CardTitle>
                        <CardDescription>
                            {status ? `Archivo procesado: ${status.processed_file}` : 'Esperando archivo...'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {(loading || processing) && !status ? (
                            localPreview ? (
                                <div className="relative w-full rounded-lg overflow-hidden border-2 border-primary bg-black h-[400px] flex items-center justify-center">
                                    <video
                                        src={localPreview}
                                        controls
                                        autoPlay
                                        muted
                                        loop
                                        className="max-w-full max-h-full opacity-50"
                                    />
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 backdrop-blur-sm">
                                        <Loader2 className="h-16 w-16 animate-spin text-white mb-4" />
                                        <div className="bg-black/70 px-4 py-2 rounded-full">
                                            <p className="text-white font-medium animate-pulse">
                                                Analizando estructura...
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-[400px] gap-4">
                                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                                    <p className="text-muted-foreground">
                                        {processing ? 'Analizando estructura...' : 'Cargando...'}
                                    </p>
                                </div>
                            )
                        ) : status ? (
                            <div className="relative w-full rounded-lg overflow-hidden border-2 border-primary bg-black h-[400px] flex items-center justify-center">
                                {status.type === 'video' ? (
                                    <video
                                        src={`${import.meta.env.VITE_API_URL?.replace('/api', '') || ''}${status.processedUrl}`}
                                        controls
                                        className="max-w-full max-h-full"
                                    />
                                ) : (
                                    <img
                                        src={`${import.meta.env.VITE_API_URL?.replace('/api', '') || ''}${status.processedUrl}`}
                                        alt="Procesado"
                                        className="max-w-full max-h-full object-contain"
                                    />
                                )}
                                <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                                    {status.timestamp && format(new Date(status.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: es })}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-[400px] border-2 border-dashed border-border rounded-lg flex-col gap-4">
                                <Upload className="h-12 w-12 text-muted-foreground" />
                                <p className="text-muted-foreground">Sube una imagen o video para comenzar</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Panel de Resultados */}
                <div className="space-y-6">
                    {/* Avance */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Avance de Obra</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-end justify-between">
                                <span className="text-4xl font-bold">{status?.score?.toFixed(0) || 0}%</span>
                                <span className="text-sm text-muted-foreground mb-1">completado</span>
                            </div>
                            {/* Progress Component Commented Out for Debugging */}
                            {/* <Progress
                                value={status?.score || 0}
                                className="h-3"
                                indicatorClassName={getProgressColor(status?.score || 0)}
                            /> */}
                            <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">
                                <div
                                    className={cn("h-full transition-all", getProgressColor(status?.score || 0))}
                                    style={{ width: `${status?.score || 0}%` }}
                                />
                            </div>

                            <div className="pt-4 border-t">
                                <p className="text-sm text-muted-foreground mb-2">Estado Actual</p>
                                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg mb-4">
                                    <HardHat className="h-5 w-5 text-primary" />
                                    <span className="font-medium">{status?.status || 'Sin datos'}</span>
                                </div>

                                {status?.explanation && (
                                    <Alert className="bg-blue-500/10 border-blue-500/20 text-blue-500">
                                        <CheckCircle2 className="h-4 w-4" />
                                        <AlertTitle>Análisis de IA</AlertTitle>
                                        <AlertDescription className="text-xs mt-1">
                                            {status.explanation}
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        </CardContent>
                    </Card>



                    {/* Estadísticas de Video (si aplica) */}
                    {status?.type === 'video' && status.stats && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Estadísticas de Video</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total Cuadros:</span>
                                    <span className="font-medium">{status.stats.total_frames}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Cuadros con Detección:</span>
                                    <span className="font-medium">{status.stats.frames_with_detection}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Visibilidad Efectiva:</span>
                                    <span className={cn("font-medium", status.stats.effective_time_percent < 30 ? "text-red-500" : "text-green-500")}>
                                        {status.stats.effective_time_percent.toFixed(1)}%
                                    </span>
                                </div>
                                {status.stats.effective_time_percent < 30 && (
                                    <Alert variant="destructive" className="mt-2 py-2">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertDescription className="text-xs">
                                            Baja visibilidad. Intenta grabar más lento.
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </div>
    )
}

export default StructureMonitor
