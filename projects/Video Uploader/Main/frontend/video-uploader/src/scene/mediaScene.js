// The Media District gallery: every uploaded file hangs as a framed plate on an arc around the viewer,
// with a pillar below it that grows with its views. Images show their real picture.
import { formatBytes, KIND_ICON } from '../lib/format'
import { streamUrl } from '../lib/api'

/* muted media-kind set that reads on paper — taken from the city palette, not hand-typed */
const KIND_COLOR = { video: 'media', image: 'api', audio: 'warn', doc: 'document', other: 'dust' }

export function buildMediaScene({ stage, three, onSelect }) {
  const { THREE, PALETTE, MODEL, skyDome, floor, groundGrid, particles, glowMat, canvasPanel, labelSprite, loadRobot, loadSkyline } = three
  const kindColor = (kind) => PALETTE[KIND_COLOR[kind]] ?? MODEL.dust
  const group = new THREE.Group()
  stage.scene.add(group)
  const offs = []
  const loader = new THREE.TextureLoader()
  let disposed = false

  skyDome(stage, MODEL.skyTop, MODEL.skyLow)
  floor(stage, { size: 80, color: MODEL.ground })
  groundGrid(stage, { color: PALETTE.ink, opacity: 0.09, size: 100, divisions: 100 })
  particles(stage, { count: 160, color: MODEL.dust, area: [60, 14, 40], size: 0.15, drift: 0.12, opacity: 0.4 })

  // daylight maquette: the stage already carries hemisphere + key sun, so these are soft accents only
  const key = new THREE.PointLight(0xfff3dc, 1.5, 34)
  key.position.set(-7, 6, 3)
  const fill = new THREE.PointLight(0xffe6bd, 1.2, 30)
  fill.position.set(8, 5, 2)
  stage.scene.add(key, fill)

  // idle hero: a spinning film reel on the stage floor when there is nothing to show
  const reel = new THREE.Group()
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.18, 32), glowMat(PALETTE.media, 0.25))
  disc.rotation.x = Math.PI / 2
  reel.add(disc)
  for (let i = 0; i < 6; i += 1) {
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.22, 16), new THREE.MeshBasicMaterial({ color: PALETTE.ink }))
    const a = (i / 6) * Math.PI * 2
    hole.position.set(Math.cos(a) * 0.65, Math.sin(a) * 0.65, 0)
    hole.rotation.x = Math.PI / 2
    reel.add(hole)
  }
  reel.position.set(0, 1.6, -2)
  stage.scene.add(reel)
  stage.onFrame((dt) => {
    reel.rotation.z += dt * 0.6 * stage.motion
  })

  loadRobot(stage, { position: [6.5, 0, 1], rotationY: -0.6, scale: 0.85, clip: 'Idle', tint: PALETTE.media }).then((r) => {
    if (!r || disposed) return
    r.play('Dance', { once: true })
    stage.interactive(r.root, { label: 'Projectionist bot', onClick: () => r.play('ThumbsUp', { once: true }) })
  })
  loadSkyline(stage, { span: 170, z: -90, tint: 0.45 })

  function clearFrames() {
    offs.splice(0).forEach((off) => off())
    group.traverse((o) => {
      o.geometry?.dispose?.()
      if (o.material) {
        o.material.map?.dispose?.()
        o.material.dispose?.()
      }
    })
    group.clear()
  }

  function wrap(ctx, text, x, y, maxW, lineH, maxLines) {
    const words = text.replace(/[._-]/g, (m) => m + '\u200b').split(/\s+|\u200b/)
    let line = ''
    let lines = 0
    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y + lines * lineH)
        lines += 1
        line = w
        if (lines >= maxLines) return
      } else line = test
    }
    if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lineH)
  }

  function makeFrame(file, index, total) {
    const g = new THREE.Group()
    const color = kindColor(file.kind)
    const W = 2.6
    const H = 1.7

    const back = new THREE.Mesh(new THREE.BoxGeometry(W + 0.22, H + 0.22, 0.12), new THREE.MeshStandardMaterial({ color: MODEL.body, roughness: 0.85, metalness: 0.05 }))
    const border = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, H + 0.3, 0.06), glowMat(color, 0.3))
    border.position.z = -0.05
    g.add(border, back)

    let face
    if (file.kind === 'image') {
      face = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: PALETTE.paper, toneMapped: false }))
      loader.load(
        streamUrl(file.name),
        (tex) => {
          if (disposed) return tex.dispose()
          tex.colorSpace = THREE.SRGBColorSpace
          face.material.map = tex
          face.material.color.set(0xffffff)
          face.material.needsUpdate = true
          // keep the picture's aspect ratio inside the frame
          const ar = tex.image.width / tex.image.height
          const frameAr = W / H
          if (ar > frameAr) face.scale.y = frameAr / ar
          else face.scale.x = ar / frameAr
        },
        undefined,
        () => {},
      )
    } else {
      const panel = canvasPanel({
        width: 512,
        height: 340,
        world: [W, H],
        transparent: false,
        draw: (ctx, w, h) => {
          const grad = ctx.createLinearGradient(0, 0, w, h)
          grad.addColorStop(0, '#fbfaf7')
          grad.addColorStop(1, '#efece4')
          ctx.fillStyle = grad
          ctx.fillRect(0, 0, w, h)
          ctx.strokeStyle = 'rgba(18,18,18,.3)'
          ctx.lineWidth = 4
          ctx.strokeRect(2, 2, w - 4, h - 4)
          ctx.font = '88px sans-serif'
          ctx.textAlign = 'left'
          ctx.textBaseline = 'alphabetic'
          ctx.fillText(KIND_ICON[file.kind] || KIND_ICON.other, 28, 120)
          ctx.fillStyle = '#121212'
          ctx.font = "500 30px Archivo, ui-sans-serif, system-ui, sans-serif"
          wrap(ctx, file.name, 28, 190, w - 56, 38, 3)
          ctx.fillStyle = 'rgba(18,18,18,.56)'
          ctx.font = "500 24px 'JetBrains Mono', ui-monospace, monospace"
          ctx.fillText(`${file.kind} · ${formatBytes(file.size)}`, 28, h - 28)
        },
      })
      face = panel.mesh
    }
    face.position.z = 0.07
    g.add(face)

    // views pillar
    const h = 0.25 + Math.min(Math.log2(1 + file.views) * 0.28, 2.2)
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.28, h, 0.28), glowMat(color, 0.3))
    pillar.position.set(0, -H / 2 - 0.35 - h / 2, 0)
    g.add(pillar)
    const tag = labelSprite(`👁 ${file.views}   ♥ ${file.likes}`, { size: 0.34 })
    tag.position.set(0, -H / 2 - 0.55 - h, 0)
    g.add(tag)

    // position on a two-row arc facing the viewer
    const perRow = Math.max(1, Math.ceil(total / 2))
    const row = index < perRow ? 0 : 1
    const inRow = row === 0 ? index : index - perRow
    const rowCount = row === 0 ? Math.min(perRow, total) : total - perRow
    const span = Math.min(Math.PI * 0.85, 0.34 * Math.max(rowCount - 1, 0) + 0.01)
    const a = rowCount === 1 ? 0 : -span / 2 + (inRow / (rowCount - 1)) * span
    const R = 10
    g.position.set(Math.sin(a) * R, 3.3 + row * 4.2, -Math.cos(a) * R + 2)
    g.lookAt(0, g.position.y, 8)
    return g
  }

  return {
    setFiles(files) {
      if (disposed) return
      clearFrames()
      const list = files.slice(0, 24)
      list.forEach((file, i) => {
        const frame = makeFrame(file, i, list.length)
        group.add(frame)
        offs.push(
          stage.interactive(frame, {
            label: () => `${file.name} — ${file.views} views · ${file.likes} likes (click to open)`,
            onClick: () => onSelect(file),
          }),
        )
      })
    },
    dispose() {
      disposed = true
      clearFrames()
    },
  }
}
