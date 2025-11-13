'use client'

import * as React from 'react'
import {
  PatchEvent,
  set,
  unset,
  type ObjectInputProps,
  type ObjectSchemaType,
} from 'sanity'
import {DetailedError as TusDetailedError, Upload as TusUpload} from 'tus-js-client'

type StreamValue = {
  playbackId?: string | null
  uid?: string | null
  duration?: number | null
  thumbnailUrl?: string | null
}

type Props = ObjectInputProps<StreamValue, ObjectSchemaType>

type CreateUploadResponse = {uploadURL: string; uid: string | null}

type UploadStage = 'idle' | 'preparing' | 'uploading' | 'processing' | 'deleting' | 'complete' | 'error'

type UploadStatus = {
  stage: UploadStage
  progress: number
  message: string | null
  detail?: string | null
}

type ProcessingProgress = {
  status: string | null
  progress: number | null
  errorReason: string | null
  playbackId: string | null
  uid: string | null
  duration: number | null
  thumbnail: string | null
}

const initialStatus: UploadStatus = {
  stage: 'idle',
  progress: 0,
  message: null,
  detail: null,
}

const UPLOAD_ABORT_ERROR = 'UPLOAD_ABORTED' as const

const POLL_INTERVAL_MS = 4000
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000
const TUS_CHUNK_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB chunks avoid single huge PATCH uploads

type UploadWithProgressOptions = {
  signal?: AbortSignal
  onRegister?: (upload: TusUpload | null) => void
}

type CreateUploadPayload = {
  filename: string
  filetype: string | undefined
  filesize: number
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function createDirectUpload(payload: CreateUploadPayload): Promise<CreateUploadResponse> {
  const res = await fetch('/api/stream/create-upload', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Impossible de créer une URL de téléversement direct.')
  return res.json()
}

async function uploadWithProgress(
  uploadURL: string,
  file: File,
  onProgress: (percent: number | null) => void,
  options?: UploadWithProgressOptions,
) {
  const {signal, onRegister} = options ?? {}

  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error(UPLOAD_ABORT_ERROR))
      return
    }

    let completed = false
    let abortHandler: (() => void) | undefined

    const finish = (callback: () => void) => {
      if (completed) return
      completed = true
      if (abortHandler && signal) {
        signal.removeEventListener('abort', abortHandler)
      }
      abortHandler = undefined
      onRegister?.(null)
      callback()
    }

    let upload: TusUpload
    try {
      upload = new TusUpload(file, {
        uploadUrl: uploadURL,
        uploadSize: file.size,
        metadata: {
          filename: file.name,
          filetype: file.type || 'application/octet-stream',
        },
        storeFingerprintForResuming: true,
        removeFingerprintOnSuccess: true,
        chunkSize: TUS_CHUNK_SIZE_BYTES,
        onProgress(bytesUploaded, bytesTotal) {
          if (!bytesTotal) {
            onProgress(null)
            return
          }
          const ratio = bytesUploaded / bytesTotal
          onProgress(Math.max(0, Math.min(100, Math.round(ratio * 100))))
        },
        onSuccess() {
          finish(resolve)
        },
        onError(error) {
          finish(() => {
            if (error instanceof TusDetailedError) {
              const response = error.originalResponse
              if (response) {
                const status = response.getStatus()
                const body = response.getBody()
                let detail = body || error.message || 'Réponse invalide'

                if (body) {
                  try {
                    const parsed = JSON.parse(body)
                    if (parsed?.errors?.length) {
                      detail = JSON.stringify(parsed.errors)
                    } else if (parsed?.messages?.length) {
                      detail = JSON.stringify(parsed.messages)
                    }
                  } catch {
                    // ignore JSON parse errors, we fall back to raw body above
                  }
                }
                reject(
                  new Error(
                    `Le téléversement vers Cloudflare a échoué (${status}) : ${detail}`,
                  ),
                )
                return
              }
              reject(new Error('Le téléversement vers Cloudflare a échoué (erreur réseau).'))
              return
            }

            if (error instanceof Error) {
              reject(error)
              return
            }

            reject(new Error('Le téléversement vers Cloudflare a échoué (erreur réseau).'))
          })
        },
        retryDelays: [0, 2000, 5000, 10000],
      })
    } catch (error) {
      onRegister?.(null)
      reject(error instanceof Error ? error : new Error(String(error)))
      return
    }

    onRegister?.(upload)

    abortHandler = () => {
      void upload.abort(true)
      finish(() => {
        reject(new Error(UPLOAD_ABORT_ERROR))
      })
    }

    if (signal) {
      signal.addEventListener('abort', abortHandler)
    }

    upload.start()
  })
}

async function pollUntilReady(
  uid: string,
  onProgress: (payload: ProcessingProgress) => void,
): Promise<{uid: string | null; playbackId: string; duration: number | null; thumbnail: string | null}> {
  const startedAt = Date.now()

  for (;;) {
    if (Date.now() - startedAt > PROCESSING_TIMEOUT_MS) {
      throw new Error('Cloudflare met trop de temps à finaliser la vidéo. Merci de réessayer.')
    }

    await sleep(POLL_INTERVAL_MS)

    const res = await fetch('/api/stream/status', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({uid}),
      cache: 'no-store',
    })

    const data = await res.json()
    if (!res.ok) {
      const label =
        res.status === 504 || data?.timedOut
          ? 'Cloudflare n’a pas retourné d’identifiant de lecture à temps.'
          : 'Impossible de récupérer le statut Cloudflare Stream.'
      throw new Error(`${label} ${JSON.stringify(data)}`)
    }

    const playbackId =
      typeof data.playbackId === 'string' && data.playbackId.trim() ? data.playbackId.trim() : null
    const payload: ProcessingProgress = {
      status: typeof data.status === 'string' ? data.status : null,
      progress: typeof data.progress === 'number' ? data.progress : null,
      errorReason: typeof data.errorReason === 'string' ? data.errorReason : null,
      playbackId,
      uid: typeof data.uid === 'string' ? data.uid : null,
      duration: typeof data.duration === 'number' ? data.duration : null,
      thumbnail: typeof data.thumbnail === 'string' ? data.thumbnail : null,
    }

    onProgress(payload)

    if (playbackId) {
      return {
        uid: payload.uid,
        playbackId,
        duration: payload.duration,
        thumbnail: payload.thumbnail,
      }
    }
  }
}

async function deleteStreamAsset(uid: string) {
  const res = await fetch('/api/stream/delete', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({uid}),
    cache: 'no-store',
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => null)
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? (payload as {error?: string; details?: unknown}).error
        : null
    const reason =
      payload && typeof payload === 'object' && 'details' in payload
        ? JSON.stringify((payload as {details?: unknown}).details)
        : null

    throw new Error(message ?? reason ?? 'Cloudflare Stream asset deletion failed.')
  }
}

function formatDuration(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null
  }
  const totalSeconds = Math.max(0, Math.floor(value))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export default function StreamUploadInput({value, onChange}: Props) {
  const [status, setStatus] = React.useState<UploadStatus>(initialStatus)
  const [error, setError] = React.useState<string | null>(null)
  const [meta, setMeta] = React.useState<{duration?: number | null; thumbnail?: string | null}>(
    {},
  )

  const tusUploadRef = React.useRef<TusUpload | null>(null)
  const abortControllerRef = React.useRef<AbortController | null>(null)

  const busy =
    status.stage === 'preparing' ||
    status.stage === 'uploading' ||
    status.stage === 'processing' ||
    status.stage === 'deleting'

  const setUploadStatus = React.useCallback((next: UploadStatus | ((prev: UploadStatus) => UploadStatus)) => {
    setStatus(prev => (typeof next === 'function' ? (next as (p: UploadStatus) => UploadStatus)(prev) : next))
  }, [])

  const clearStreamFields = React.useCallback(() => {
    onChange(
      PatchEvent.from([
        unset(),
        unset(['streamUid'])
    ])
    )
  }, [onChange])

  const abortCurrentUpload = React.useCallback(() => {
    const controller = abortControllerRef.current
    abortControllerRef.current = null
    if (controller && !controller.signal.aborted) {
      controller.abort()
    }

    const currentUpload = tusUploadRef.current
    tusUploadRef.current = null
    if (currentUpload) {
      currentUpload.abort(true).catch(() => undefined)
    }
  }, [])

  const resetState = React.useCallback(() => {
    abortCurrentUpload()
    setUploadStatus(initialStatus)
    setError(null)
    setMeta({})
  }, [abortCurrentUpload, setUploadStatus])

  React.useEffect(() => {
    return () => {
      abortCurrentUpload()
    }
  }, [abortCurrentUpload])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {

    const file = e.target.files?.[0]

    if (!file) return

    abortCurrentUpload()

    setError(null)

    setUploadStatus({
      stage: 'preparing',

      progress: 5,

      message: 'Préparation du téleversement.',

      detail: `Fichier sélectionné : ${file.name}`,
    })

    const controller = new AbortController()

    abortControllerRef.current = controller

    try {
      const {uploadURL, uid} = await createDirectUpload({

        filename: file.name,

        filetype: file.type || 'application/octet-stream',

        filesize: file.size,

      })

      if (!uid) {
        throw new Error("Cloudflare n'a pas renvoyé d'UID pour ce téleversement.")
      }

      setUploadStatus({
        stage: 'uploading',

        progress: 10,

        message: 'Téléversement vers Cloudflare.',

        detail: '0 %',
      })

      await uploadWithProgress(
        uploadURL,
        file,
        percent => {
          setUploadStatus(prev => {
            if (typeof percent === 'number' && Number.isFinite(percent)) {
              const normalized = Math.max(prev.progress, Math.min(90, Math.round(10 + percent * 0.8)))
              
              return {
                stage: 'uploading',
                progress: normalized,
                message: 'Téléversement vers Cloudflare.',
                detail: `${Math.round(percent)} %`,
              }
            }

            return {
              stage: 'uploading',
              progress: Math.min(90, prev.progress + 1),
              message: 'Téléversement vers Cloudflare.',
              detail: 'Calcul du volume transfère.',
            }
          })
        },
        {
          signal: controller.signal,
          onRegister: upload => {
            tusUploadRef.current = upload
          },
        },
      )

      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }

      setUploadStatus({
        stage: 'processing',
        progress: 90,
        message: 'Traitement vidéo par Cloudflare (cela peut prendre quelques minutes).',
        detail: 'Analyse du flux en cours.',
      })

      const {
        uid: processedUid,
        playbackId,
        duration,
        thumbnail,
      } = await pollUntilReady(uid, payload => {

        setUploadStatus(prev => {
          let normalized = Math.min(99, prev.progress + 1)
          const parts: string[] = []

          if (typeof payload.progress === 'number' && Number.isFinite(payload.progress)) {
            normalized = Math.max(
              prev.progress,
              Math.min(99, Math.round(90 + payload.progress * 0.09)),
            )

            parts.push(`${Math.round(payload.progress)} %`)
          }

          if (payload.status) {
            parts.unshift(`Etape : ${payload.status}`)
          }

          if (payload.errorReason) {
            parts.push(`Alerte Cloudflare : ${payload.errorReason}`)
          }

          return {
            stage: 'processing',
            progress: normalized,
            message: 'Traitement vidéo par Cloudflare (cela peut prendre quelques minutes).',
            detail: parts.length > 0 ? parts.join(' | ') : prev.detail ?? null,
          }
        })
      })

      queueMicrotask(() => {
        const patches = [set(playbackId)]
        const finalUid = processedUid ?? uid
        if (finalUid) {
          patches.push(set(finalUid, ['streamUid']))
        }
        const patchesObj = [...patches]
        onChange(PatchEvent.from(patchesObj))
      })

      setUploadStatus({
        stage: 'complete',
        progress: 100,
        message: 'Téléversement finalisé !',
        detail: 'Identifiants Cloudflare enregistrés dans Sanity.',
      })

      setMeta({duration, thumbnail})
    } catch (err) {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }

      if (err instanceof Error && err.message === UPLOAD_ABORT_ERROR) {
        resetState()
        clearStreamFields()
        return
      }

      console.error(err)

      const detail = err instanceof Error ? err.message : String(err)

      setUploadStatus({
        stage: 'error',
        progress: 0,
        message: 'Le téléversement a échoué.',
        detail,
      })

      setError(detail)

      clearStreamFields()
    } finally {
      e.target.value = ''
    }
  }

  async function clearValue() {
    abortCurrentUpload()

    const storedUid =

      typeof value?.uid === 'string' && value?.uid.trim() ? value?.uid.trim() : null

    if (!value && !storedUid) {
      clearStreamFields()

      resetState()

      return
    }

    if (!storedUid) {
      const message = "Impossible de trouver l'UID Cloudflare à supprimer."

      setError(message)

      setUploadStatus({
        stage: 'error',
        progress: 0,
        message,
        detail: 'Actualisez la page ou relancez le téléversement.',
      })

      return
    }

    setError(null)

    setUploadStatus({
      stage: 'deleting',
      progress: 25,
      message: 'Suppression du flux Cloudflare.',
      detail: `UID : ${storedUid}`,
    })

    try {
      await deleteStreamAsset(storedUid)

      clearStreamFields()

      setMeta({})

      setUploadStatus({
        stage: 'complete',
        progress: 100,
        message: 'Vidéo Cloudflare supprimée.',
        detail: null,
      })

    } catch (err) {
      console.error(err)

      const message = err instanceof Error ? err.message : String(err)

      setError(message)

      setUploadStatus({
        stage: 'error',
        progress: 0,
        message: 'Impossible de supprimer la ressource Cloudflare.',
        detail: message,
      })
    }
  }

  const formattedDuration = formatDuration(meta?.duration)
  const playbackId = value?.playbackId ?? null

  return (
    <div style={{display: 'grid', gap: 12}}>
      {playbackId ? (
        <div style={{display: 'grid', gap: 6}}>
          <div>
            <strong>Identifiant de lecture :</strong> {playbackId}
          </div>
          <div style={{display: 'flex', gap: 8}}>
            <button type="button" onClick={clearValue} disabled={busy}>
              Effacer
            </button>
          </div>
        </div>
      ) : (
        <div style={{display: 'grid', gap: 6}}>
          <input type="file" accept="video/*" onChange={handleFileChange} disabled={busy} />
        </div>
      )}

      {status.message ? (
        <div
          style={{
            display: 'grid',
            gap: 6,
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 12,
            backgroundColor:
              status.stage === 'error' ? '#fef2f2' : status.stage === 'complete' ? '#f0fdf4' : '#f9fafb',
          }}
        >
          <div style={{fontWeight: 600, color: '#111827'}}>{status.message}</div>
          <div
            style={{
              position: 'relative',
              height: 8,
              borderRadius: 9999,
              backgroundColor: '#e5e7eb',
              overflow: 'hidden',
            }}
            aria-hidden="true"
          >
            <div
              style={{
                width: `${Math.max(0, Math.min(100, status.progress))}%`,
                height: '100%',
                backgroundColor: status.stage === 'complete' ? '#16a34a' : '#2563eb',
                transition: 'width 200ms ease',
              }}
            />
          </div>
          {status.detail ? (
            <div style={{color: '#374151', fontSize: 12}}>{status.detail}</div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div style={{color: '#b91c1c', fontSize: 12}}>
          {error}
        </div>
      ) : null}

      {meta?.thumbnail ? (
        <div style={{display: 'grid', gap: 6, maxWidth: 320}}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={meta.thumbnail}
            alt="Miniature Cloudflare"
            style={{width: '100%', borderRadius: 8, border: '1px solid #e5e7eb'}}
          />
        </div>
      ) : null}

      {formattedDuration ? (
        <div style={{color: '#6b7280', fontSize: 12}}>Durée estimée : {formattedDuration}</div>
      ) : null}
    </div>
  )
}
