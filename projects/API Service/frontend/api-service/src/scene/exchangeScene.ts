import type { ThreeKit } from '../lib/city'
import type { Quote } from '../lib/api'

type Tower = {
  group: ThreeKit
  body: ThreeKit
  cap: ThreeKit
  label: ThreeKit | null
  current: number
  target: number
  base: number
}

/** One glowing tower per listed company: taller = pricier, green = up, red = down. Click a tower to trade it. */
export function buildExchangeScene({
  stage,
  three,
  onSelect,
}: {
  stage: ThreeKit
  three: ThreeKit
  onSelect: (symbol: string) => void
}) {
  const { THREE, PALETTE, skyDome, floor, groundGrid, particles, glowMat, labelSprite } = three

  skyDome(stage, 0x03121a, 0x040a10)
  floor(stage, { size: 70, color: 0x07131a })
  groundGrid(stage, { color: PALETTE.exchange, opacity: 0.2, size: 80, divisions: 80 })
  particles(stage, { count: 180, color: PALETTE.exchange, area: [50, 16, 40], size: 0.13, drift: 0.14 })

  const teal = new THREE.PointLight(PALETTE.exchange, 60, 36)
  teal.position.set(0, 9, 6)
  stage.scene.add(teal)

  const towers = new Map<string, Tower>()
  const offs: Array<() => void> = []
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.05, 10, 48), glowMat(0xffffff, 2.5))
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.06
  ring.visible = false
  stage.scene.add(ring)

  stage.onFrame((dt: number) => {
    towers.forEach((t) => {
      t.current += (t.target - t.current) * Math.min(1, dt * 2.2)
      t.body.scale.y = t.current
      t.body.position.y = t.current / 2
      t.cap.position.y = t.current + 0.05
      if (t.label) t.label.position.y = t.current + 1
    })
    ring.rotation.z += dt * 0.8 * stage.motion
  })

  function disposeLabel(label: ThreeKit | null) {
    if (!label) return
    label.parent?.remove(label)
    label.material.map?.dispose()
    label.material.dispose()
  }

  return {
    update(quotes: Quote[]) {
      const n = quotes.length
      quotes.forEach((q, i) => {
        let t = towers.get(q.symbol)
        if (!t) {
          const group = new THREE.Group()
          group.position.set((i - (n - 1) / 2) * 3.4, 0, 0)
          const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1, 1.8), glowMat(PALETTE.up, 0.9, { transparent: true, opacity: 0.88 }))
          const cap = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.1, 1.95), glowMat(PALETTE.up, 2.4))
          group.add(body, cap)
          stage.scene.add(group)
          t = { group, body, cap, label: null, current: 0.2, target: 1, base: 0 }
          towers.set(q.symbol, t)
          offs.push(
            stage.interactive(group, {
              label: () => {
                const cur = towers.get(q.symbol)
                return cur ? `${q.symbol} — click to trade` : q.symbol
              },
              onClick: () => onSelect(q.symbol),
            }),
          )
        }
        const color = q.change >= 0 ? PALETTE.up : PALETTE.down
        t.body.material.color.set(color)
        t.body.material.emissive.set(color)
        t.cap.material.color.set(color)
        t.cap.material.emissive.set(color)
        t.target = 1 + q.price * 0.05
        disposeLabel(t.label)
        t.label = labelSprite(`${q.symbol} ₹${q.price} ${q.change >= 0 ? '▲' : '▼'}${Math.abs(q.change).toFixed(1)}%`, { size: 0.62 })
        t.group.add(t.label)
        t.label.position.y = t.current + 1
      })
    },

    select(symbol: string | null) {
      const t = symbol ? towers.get(symbol) : undefined
      ring.visible = !!t
      if (t) ring.position.x = t.group.position.x
    },

    dispose() {
      offs.forEach((off) => off())
      towers.forEach((t) => {
        disposeLabel(t.label)
        stage.scene.remove(t.group)
        t.body.geometry.dispose()
        t.body.material.dispose()
        t.cap.geometry.dispose()
        t.cap.material.dispose()
      })
      towers.clear()
      stage.scene.remove(ring)
    },
  }
}
