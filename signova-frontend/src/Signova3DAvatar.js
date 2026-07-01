import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { SIGN_ANIMATION_LIBRARY } from './signLearningData';

const DEFAULT_AVATAR_URLS = {
  female: process.env.REACT_APP_SIGNOVA_FEMALE_AVATAR_URL || process.env.REACT_APP_SIGNOVA_AVATAR_URL || '',
  male: process.env.REACT_APP_SIGNOVA_MALE_AVATAR_URL || '',
};

function useAdaptiveFrameRate(requestedFps = 'adaptive') {
  const [detectedRefreshRate, setDetectedRefreshRate] = useState(60);

  useEffect(() => {
    let frame = 0;
    let previous = 0;
    const samples = [];
    let rafId = 0;
    const sample = (now) => {
      if (previous) {
        const delta = now - previous;
        if (delta > 2 && delta < 50) samples.push(delta);
      }
      previous = now;
      frame += 1;
      if (frame < 90) {
        rafId = window.requestAnimationFrame(sample);
        return;
      }
      const sorted = samples.sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] || 16.67;
      setDetectedRefreshRate(Math.max(30, Math.min(165, Math.round(1000 / median))));
    };
    rafId = window.requestAnimationFrame(sample);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  if (requestedFps !== 'adaptive') return Math.max(30, Math.min(120, Number(requestedFps) || 60));
  const memory = Number(navigator.deviceMemory || 8);
  const cores = Number(navigator.hardwareConcurrency || 8);
  if (memory <= 4 || cores <= 4) return 30;
  if (detectedRefreshRate >= 120 && memory >= 8 && cores >= 8) return 120;
  if (detectedRefreshRate >= 90 && memory >= 6) return 90;
  return 60;
}

function AdaptiveRenderLoop({ fps, paused }) {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (paused) {
      invalidate();
      return undefined;
    }
    let rafId = 0;
    let previous = 0;
    const interval = 1000 / fps;
    const render = (now) => {
      if (!previous || now - previous >= interval - 0.7) {
        previous = now;
        invalidate();
      }
      rafId = window.requestAnimationFrame(render);
    };
    rafId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(rafId);
  }, [fps, invalidate, paused]);

  return null;
}

function Limb({ side, shoulderRef, elbowRef }) {
  return (
    <group ref={shoulderRef} position={[side * 0.68, 1.08, 0]}>
      <mesh position={[0, -0.34, 0]} castShadow>
        <capsuleGeometry args={[0.15, 0.58, 8, 16]} />
        <meshStandardMaterial color="#1768d2" roughness={0.48} />
      </mesh>
      <group ref={elbowRef} position={[0, -0.7, 0]}>
        <mesh position={[0, -0.29, 0]} castShadow>
          <capsuleGeometry args={[0.125, 0.48, 8, 16]} />
          <meshStandardMaterial color="#d99a79" roughness={0.7} />
        </mesh>
        <mesh position={[0, -0.68, 0]} scale={[0.72, 1.05, 0.45]} castShadow>
          <sphereGeometry args={[0.18, 24, 18]} />
          <meshStandardMaterial color="#d99a79" roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

function RealisticHumanoid({ url, animation, paused, speed, view }) {
  const gltf = useLoader(GLTFLoader, url);
  const root = useRef();
  const mixer = useRef();
  const currentAction = useRef();
  const scene = useMemo(() => cloneSkeleton(gltf.scene), [gltf.scene]);
  const clips = gltf.animations;

  useEffect(() => {
    mixer.current = new THREE.AnimationMixer(scene);
    return () => {
      mixer.current?.stopAllAction();
      mixer.current?.uncacheRoot(scene);
    };
  }, [scene]);

  useEffect(() => {
    if (!mixer.current || !clips.length) return undefined;
    const requestedNames = [
      animation?.clip,
      animation?.id,
      `sign_${animation?.id}`,
      animation?.label,
      'idle',
    ].filter(Boolean).map((name) => String(name).toLowerCase());
    const clip = clips.find((item) => requestedNames.includes(item.name.toLowerCase())) || clips[0];
    const action = mixer.current.clipAction(clip);
    action.reset().setEffectiveTimeScale(speed).setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.22).play();
    currentAction.current?.crossFadeTo(action, 0.22, false);
    currentAction.current = action;
    return () => action.fadeOut(0.16);
  }, [animation, clips, speed]);

  useEffect(() => {
    scene.traverse((object) => {
      if (!object.isMesh || !object.morphTargetDictionary || !object.morphTargetInfluences) return;
      const expression = String(animation?.expression || '').toLowerCase();
      Object.entries(object.morphTargetDictionary).forEach(([name, index]) => {
        const normalized = name.toLowerCase();
        const active = (expression.includes('smile') && normalized.includes('smile'))
          || (expression.includes('concern') && (normalized.includes('brow') || normalized.includes('sad')))
          || (expression.includes('question') && normalized.includes('brow'));
        object.morphTargetInfluences[index] = active ? 0.55 : 0;
      });
    });
  }, [animation, scene]);

  useFrame((_, delta) => {
    if (!paused) mixer.current?.update(Math.min(delta, 0.05) * speed);
    if (root.current) {
      const target = view === 'side' ? -Math.PI * 0.42 : 0;
      root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, target, 8, delta);
    }
  });

  return (
    <group ref={root} position={[0, -1.55, 0]} scale={1.55}>
      <primitive object={scene} />
    </group>
  );
}

function RiggedCoach({ animation, poseIndex, paused, speed, view, coach }) {
  const rig = useRef();
  const leftShoulder = useRef();
  const rightShoulder = useRef();
  const leftElbow = useRef();
  const rightElbow = useRef();
  const pose = animation?.poses?.[poseIndex % animation.poses.length] || SIGN_ANIMATION_LIBRARY.okay.poses[0];
  const targetRotation = view === 'side' ? -0.86 : 0;

  useFrame((state, delta) => {
    if (!rig.current) return;
    const damping = 1 - Math.exp(-Math.min(delta, 0.05) * 7 * speed);
    rig.current.rotation.y = THREE.MathUtils.lerp(rig.current.rotation.y, targetRotation, damping);
    if (!paused) rig.current.position.y = -0.42 + Math.sin(state.clock.elapsedTime * 1.5) * 0.012;
    [
      [leftShoulder.current, pose.left],
      [rightShoulder.current, pose.right],
    ].forEach(([joint, rotation]) => {
      if (!joint || !rotation) return;
      joint.rotation.z = THREE.MathUtils.lerp(joint.rotation.z, rotation[0], damping);
      joint.rotation.x = THREE.MathUtils.lerp(joint.rotation.x, rotation[1], damping);
      joint.rotation.y = THREE.MathUtils.lerp(joint.rotation.y, rotation[2], damping);
    });
    if (leftElbow.current) leftElbow.current.rotation.z = THREE.MathUtils.lerp(leftElbow.current.rotation.z, -0.68, damping);
    if (rightElbow.current) rightElbow.current.rotation.z = THREE.MathUtils.lerp(rightElbow.current.rotation.z, 0.74, damping);
  });

  const isFemale = coach === 'female';
  return (
    <group ref={rig} position={[0, -0.42, 0]}>
      <mesh position={[0, 0.32, 0]} castShadow>
        <capsuleGeometry args={[0.58, 1.08, 12, 24]} />
        <meshStandardMaterial color={isFemale ? '#1768d2' : '#1359b6'} roughness={0.48} />
      </mesh>
      <mesh position={[0, -0.58, 0]} castShadow>
        <cylinderGeometry args={[0.53, 0.66, 0.42, 32]} />
        <meshStandardMaterial color="#0f4a9d" roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.12, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.31, 0.24, 24]} />
        <meshStandardMaterial color="#d99a79" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.66, 0]} scale={[0.88, 1.06, 0.92]} castShadow>
        <sphereGeometry args={[0.52, 36, 28]} />
        <meshStandardMaterial color="#d99a79" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.86, -0.02]} scale={[0.91, 0.62, 0.94]} castShadow>
        <sphereGeometry args={[0.54, 36, 24]} />
        <meshStandardMaterial color="#211711" roughness={0.82} />
      </mesh>
      {isFemale && (
        <>
          <mesh position={[-0.42, 1.45, -0.08]} scale={[0.34, 1.25, 0.3]} castShadow>
            <sphereGeometry args={[0.46, 30, 22]} />
            <meshStandardMaterial color="#211711" roughness={0.82} />
          </mesh>
          <mesh position={[0.42, 1.45, -0.08]} scale={[0.34, 1.25, 0.3]} castShadow>
            <sphereGeometry args={[0.46, 30, 22]} />
            <meshStandardMaterial color="#211711" roughness={0.82} />
          </mesh>
        </>
      )}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.18, 1.72, 0.46]} scale={[1, 1.1, 0.5]}>
            <sphereGeometry args={[0.05, 16, 12]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
          <mesh position={[side * 0.18, 1.72, 0.485]}>
            <sphereGeometry args={[0.022, 12, 10]} />
            <meshStandardMaterial color="#172033" />
          </mesh>
        </group>
      ))}
      <Limb side={-1} shoulderRef={leftShoulder} elbowRef={leftElbow} />
      <Limb side={1} shoulderRef={rightShoulder} elbowRef={rightElbow} />
    </group>
  );
}

export default function Signova3DAvatar({
  animation = SIGN_ANIMATION_LIBRARY.okay,
  step = 0,
  poseIndex = step,
  paused = false,
  speed = 1,
  view = 'front',
  targetFps = 'adaptive',
  coach = 'female',
  modelUrl,
  label = 'Signova 3D sign coach',
}) {
  const camera = useMemo(() => ({ position: [0, 1, 6.5], fov: 31 }), []);
  const adaptiveFps = useAdaptiveFrameRate(targetFps);
  const resolvedModelUrl = modelUrl || DEFAULT_AVATAR_URLS[coach] || '';
  return (
    <div className="signova3DAvatarViewport" role="img" aria-label={`${label}. Rendering at up to ${adaptiveFps} frames per second.`}>
      <Canvas
        camera={camera}
        dpr={[1, adaptiveFps >= 90 ? 1.75 : 1.5]}
        frameloop="demand"
        shadows
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <AdaptiveRenderLoop fps={adaptiveFps} paused={paused} />
        <ambientLight intensity={1.25} />
        <hemisphereLight color="#eaf8ff" groundColor="#52647a" intensity={1.8} />
        <directionalLight position={[3.2, 5, 4.5]} intensity={2.4} castShadow />
        <directionalLight position={[-4, 2, -2]} color="#57d8ff" intensity={1.3} />
        <Suspense fallback={null}>
          {resolvedModelUrl ? (
            <RealisticHumanoid url={resolvedModelUrl} animation={animation} paused={paused} speed={speed} view={view} />
          ) : (
            <RiggedCoach animation={animation} poseIndex={poseIndex} paused={paused} speed={speed} view={view} coach={coach} />
          )}
        </Suspense>
        <mesh position={[0, -1.56, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[1.55, 48]} />
          <meshStandardMaterial color="#b9dff4" transparent opacity={0.24} roughness={1} />
        </mesh>
      </Canvas>
    </div>
  );
}
