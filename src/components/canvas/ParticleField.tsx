'use client'

import { useEffect, useRef } from 'react'

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  originX: number
  originY: number
  size: number
}

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    let animationFrame = 0
    let width = 0
    let height = 0
    let particles: Particle[] = []
    const mouse = { x: -9999, y: -9999 }

    const resize = () => {
      const ratio = window.devicePixelRatio || 1
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * ratio
      canvas.height = height * ratio
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(ratio, 0, 0, ratio, 0, 0)

      const count = Math.min(150, Math.max(75, Math.floor((width * height) / 12500)))
      particles = Array.from({ length: count }, () => {
        const x = Math.random() * width
        const y = Math.random() * height
        return {
          x,
          y,
          originX: x,
          originY: y,
          vx: (Math.random() - 0.5) * 0.45,
          vy: (Math.random() - 0.5) * 0.45,
          size: Math.random() * 1.8 + 0.6,
        }
      })
    }

    const draw = () => {
      context.clearRect(0, 0, width, height)
      context.fillStyle = 'rgba(2, 6, 23, 0.9)'
      context.fillRect(0, 0, width, height)

      const gradient = context.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 360)
      gradient.addColorStop(0, 'rgba(0, 255, 209, 0.16)')
      gradient.addColorStop(0.42, 'rgba(131, 56, 236, 0.08)')
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
      context.fillStyle = gradient
      context.fillRect(0, 0, width, height)

      for (const particle of particles) {
        const dx = mouse.x - particle.x
        const dy = mouse.y - particle.y
        const dist = Math.max(40, Math.sqrt(dx * dx + dy * dy))
        const pull = Math.min(0.055, 2200 / (dist * dist * dist))

        particle.vx += dx * pull + (particle.originX - particle.x) * 0.0007
        particle.vy += dy * pull + (particle.originY - particle.y) * 0.0007
        particle.vx *= 0.94
        particle.vy *= 0.94
        particle.x += particle.vx
        particle.y += particle.vy

        if (particle.x < -20 || particle.x > width + 20 || particle.y < -20 || particle.y > height + 20) {
          particle.x = Math.random() * width
          particle.y = Math.random() * height
          particle.originX = particle.x
          particle.originY = particle.y
        }
      }

      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const a = particles[i]
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 132) {
            context.strokeStyle = `rgba(0, 255, 209, ${0.18 * (1 - dist / 132)})`
            context.lineWidth = 1
            context.beginPath()
            context.moveTo(a.x, a.y)
            context.lineTo(b.x, b.y)
            context.stroke()
          }
        }
      }

      context.fillStyle = 'rgba(185, 255, 246, 0.86)'
      for (const particle of particles) {
        context.beginPath()
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        context.fill()
      }

      animationFrame = requestAnimationFrame(draw)
    }

    const onMouseMove = (event: MouseEvent) => {
      mouse.x = event.clientX
      mouse.y = event.clientY
    }

    const onMouseLeave = () => {
      mouse.x = -9999
      mouse.y = -9999
    }

    resize()
    draw()
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseleave', onMouseLeave)

    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
}
