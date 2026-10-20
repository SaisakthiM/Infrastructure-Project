import type { ThreeKit } from '../lib/city'
import { latLonToXYZ } from '../lib/format'

export type GlobeMarker = {
  lat: number
  lon: number
  color?: number
  size?: number
  label?: string
  onClick?: () => void
}

type Handle = { mesh: ThreeKit; off: () => void; phase: number }

/** An Earth with day/night textures, clouds, an atmosphere glow and named layers of markers. */
export function createGlobe(three: ThreeKit, stage: ThreeKit, opts: { radius?: number; spin?: boolean } = {}) {
  const { THREE, ASSETS } = three
  const radius: number = opts.radius ?? 5
  let spin = opts.spin ?? true

  const group = new THREE.Group()
  const loader = new THREE.TextureLoader()

  const earthTex = loader.load(ASSETS.earth)
  earthTex.colorSpace = THREE.SRGBColorSpace
  const lightsTex = loader.load(ASSETS.lights)
  lightsTex.colorSpace = THREE.SRGBColorSpace
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 48),
    new THREE.MeshStandardMaterial({
      map: earthTex,
      emissiveMap: lightsTex,
      emissive: new THREE.Color(0xffc477),
      emissiveIntensity: 0.45,
      roughness: 0.9,
      metalness: 0.05,
    }),
  )

  const cloudTex = loader.load(ASSETS.clouds)
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.012, 48, 36),
    new THREE.MeshStandardMaterial({ map: cloudTex, transparent: true, opacity: 0.35, depthWrite: false }),
  )

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.14, 48, 36),
    new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      uniforms: { c: { value: new THREE.Color(0x4aa3ff) } },
      vertexShader: 'varying vec3 n; void main(){ n = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader:
        'uniform vec3 c; varying vec3 n; void main(){ float i = pow(max(0.0, 0.72 - dot(n, vec3(0.0, 0.0, 1.0))), 3.0); gl_FragColor = vec4(c, 1.0) * i * 1.4; }',
    }),
  )

  group.add(earth, clouds, atmosphere)
  stage.scene.add(group)

  const layers = new Map<string, Handle[]>()
  let focus: { from: ThreeKit; to: ThreeKit; t: number } | null = null
  let time = 0

  stage.onFrame((dt: number, t: number) => {
    time = t
    if (spin) {
      earth.rotation.y += dt * 0.035 * stage.motion
      clouds.rotation.y += dt * 0.045 * stage.motion
    }
    layers.forEach((handles) =>
      handles.forEach((h) => {
        const k = 1 + 0.18 * Math.sin(time * 3 + h.phase)
        h.mesh.scale.setScalar(k)
      }),
    )
    if (focus) {
      focus.t = Math.min(1, focus.t + dt / 1.2)
      const e = 1 - Math.pow(1 - focus.t, 3)
      stage.camera.position.lerpVectors(focus.from, focus.to, e)
      stage.camera.lookAt(0, 0, 0)
      if (focus.t >= 1) focus = null
    }
  })

  function clearLayer(name: string) {
    ;(layers.get(name) || []).forEach((h) => {
      h.off()
      earth.remove(h.mesh)
      h.mesh.geometry.dispose()
      h.mesh.material.dispose()
    })
    layers.delete(name)
  }

  return {
    group,
    earth,
    radius,

    /** replaces every marker in a named layer (quakes, iss, pin …) */
    setMarkers(name: string, list: GlobeMarker[]) {
      clearLayer(name)
      const handles: Handle[] = list.map((m, i) => {
        const size = m.size ?? 0.08
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(size, 12, 10),
          new THREE.MeshBasicMaterial({ color: m.color ?? 0xffffff, toneMapped: false }),
        )
        const [x, y, z] = latLonToXYZ(m.lat, m.lon, radius * 1.004)
        mesh.position.set(x, y, z)
        earth.add(mesh)
        const off =
          m.onClick || m.label
            ? stage.interactive(mesh, { label: m.label, onClick: m.onClick })
            : () => {}
        return { mesh, off, phase: i * 0.7 }
      })
      layers.set(name, handles)
    },

    /** swing the camera to look straight down at a place */
    focusOn(lat: number, lon: number, distance = 13) {
      const [x, y, z] = latLonToXYZ(lat, lon, 1)
      const dir = new THREE.Vector3(x, y, z).applyQuaternion(earth.quaternion).normalize()
      focus = { from: stage.camera.position.clone(), to: dir.multiplyScalar(distance), t: 0 }
    },

    setSpin(on: boolean) {
      spin = on
    },

    dispose() {
      Array.from(layers.keys()).forEach(clearLayer)
      stage.scene.remove(group)
      ;[earth, clouds, atmosphere].forEach((m) => {
        m.geometry.dispose()
        m.material.dispose()
      })
      earthTex.dispose()
      lightsTex.dispose()
      cloudTex.dispose()
    },
  }
}

export type Globe = ReturnType<typeof createGlobe>
