'use client'

import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface SignaturePadHandle {
  isEmpty: () => boolean
  toDataURL: () => string
  clear: () => void
}

interface SignaturePadProps {
  label: string
  className?: string
}

function getPos(canvas: HTMLCanvasElement, e: React.MouseEvent | React.TouchEvent) {
  const rect = canvas.getBoundingClientRect()
  const point = 'touches' in e ? e.touches[0] : e
  return {
    x: ((point.clientX - rect.left) / rect.width) * canvas.width,
    y: ((point.clientY - rect.top) / rect.height) * canvas.height,
  }
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad({ label, className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const drawingRef = useRef(false)
    const [hasDrawn, setHasDrawn] = useState(false)

    useImperativeHandle(ref, () => ({
      isEmpty: () => !hasDrawn,
      toDataURL: () => canvasRef.current?.toDataURL('image/png') ?? '',
      clear: () => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
        setHasDrawn(false)
      },
    }))

    function start(e: React.MouseEvent | React.TouchEvent) {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      drawingRef.current = true
      const { x, y } = getPos(canvas, e)
      ctx.beginPath()
      ctx.moveTo(x, y)
    }

    function move(e: React.MouseEvent | React.TouchEvent) {
      if (!drawingRef.current) return
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      e.preventDefault()
      const { x, y } = getPos(canvas, e)
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.strokeStyle = '#111827'
      ctx.lineTo(x, y)
      ctx.stroke()
      setHasDrawn(true)
    }

    function end() {
      drawingRef.current = false
    }

    function handleClear() {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      setHasDrawn(false)
    }

    return (
      <div className={className}>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            {label} <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            지우기
          </button>
        </div>
        <canvas
          ref={canvasRef}
          width={400}
          height={140}
          className={cn(
            'w-full touch-none rounded-lg border bg-white',
            hasDrawn ? 'border-gray-300' : 'border-dashed border-gray-300'
          )}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
        {!hasDrawn && (
          <p className="mt-1 text-xs text-gray-400">위 칸에 직접 서명해주세요.</p>
        )}
      </div>
    )
  }
)
