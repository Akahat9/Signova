import { SIGN_ANIMATION_LIBRARY } from './signLearningData';

function Hand({ closed = false }) {
  return (
    <g className={closed ? 'signova2dHand signova2dFist' : 'signova2dHand'}>
      <ellipse cx="0" cy="0" rx="18" ry="15" />
      {!closed && [-12, -6, 0, 6, 12].map((x, index) => (
        <line key={x} x1={x} y1="-7" x2={x * 1.35} y2={-29 - Math.abs(2 - index) * 2} />
      ))}
    </g>
  );
}

function Arm({ side, rotation, closed }) {
  const shoulderX = side === 'left' ? 166 : 334;
  const direction = side === 'left' ? -1 : 1;
  const shoulderAngle = direction * 18 + Number(rotation?.[0] || 0) * 42;
  const elbowAngle = direction * (28 + Number(rotation?.[2] || 0) * 24);
  return (
    <g className="signova2dArm" transform={`translate(${shoulderX} 190) rotate(${shoulderAngle})`}>
      <circle className="signova2dShoulderJoint" cx="0" cy="0" r="22" />
      <rect x={direction < 0 ? -78 : 0} y="-18" width="78" height="36" rx="18" />
      <g transform={`translate(${direction * 76} 0) rotate(${elbowAngle})`}>
        <circle className="signova2dElbowJoint" cx="0" cy="0" r="16" />
        <rect className="signova2dForearm" x={direction < 0 ? -72 : 0} y="-15" width="72" height="30" rx="15" />
        <g transform={`translate(${direction * 76} 0)`}>
          <Hand closed={closed} />
        </g>
      </g>
    </g>
  );
}

export default function Signova2DAvatar({
  animation = SIGN_ANIMATION_LIBRARY.okay,
  poseIndex = 0,
  paused = false,
  speed = 1,
  view = 'front',
  coach = 'female',
  interaction = { x: 0, y: 0 },
  label = 'Signova 2D sign coach',
}) {
  const poses = animation?.poses?.length ? animation.poses : SIGN_ANIMATION_LIBRARY.okay.poses;
  const pose = poses[poseIndex % poses.length];
  const closed = /fist|help/i.test(`${animation?.handshape || ''} ${animation?.id || ''}`);
  const transitionMs = Math.max(120, Math.round(420 / Math.max(0.4, Number(speed) || 1)));
  return (
    <div
      className={`signova2dAvatarViewport signova2dImageIdentity ${paused ? 'signova2dPaused' : ''} signova2d-${view}`}
      role="img"
      aria-label={label}
      style={{ '--signova-2d-transition': `${transitionMs}ms` }}
    >
      <svg viewBox="0 0 500 500" aria-hidden="true" style={{ '--coach-drag-x': interaction.x, '--coach-drag-y': interaction.y }}>
        <defs>
          <linearGradient id="signova2d-shirt" x1="0" x2="1">
            <stop stopColor="#0878e8" />
            <stop offset="1" stopColor="#2da8ff" />
          </linearGradient>
          <clipPath id="signova2dIdentityClip"><ellipse cx="250" cy="102" rx="92" ry="105" /></clipPath>
        </defs>
        <ellipse className="signova2dShadow" cx="250" cy="454" rx="132" ry="25" />
        {!paused && (
          <g className="signova2dMotionGuide">
            <path d="M82 151 Q44 205 91 255" />
            <path d="M418 151 Q456 205 409 255" />
          </g>
        )}
        <g className="signova2dRig" style={{ transform: `translate(${interaction.x * 24}px, ${interaction.y * 22}px) scaleX(${1 - Math.abs(interaction.x) * 0.13})`, transformOrigin: '250px 255px' }}>
          <path className="signova2dTorso" d="M165 185 Q175 145 215 140 H285 Q325 145 335 185 L350 410 Q300 438 250 438 Q200 438 150 410Z" />
          <Arm side="left" rotation={pose.left} closed={closed} />
          <Arm side="right" rotation={pose.right} closed={closed} />
          <rect className="signova2dNeck" x="226" y="116" width="48" height="50" rx="20" />
          <ellipse className="signova2dFace" cx="250" cy="91" rx="70" ry="78" />
          <path className={`signova2dHair ${coach === 'male' ? 'signova2dHairMale' : ''}`} d={coach === 'male'
            ? 'M184 85 Q190 8 250 8 Q316 10 320 81 Q284 48 250 50 Q216 48 184 85Z'
            : 'M178 103 Q174 10 250 7 Q330 12 324 114 L307 151 L294 69 Q250 44 205 69 L193 154Z'} />
          {coach !== 'male' && <image className="signova2dIdentityImage" href="/signova-signing-coach.png" x="0" y="-2" width="500" height="500" clipPath="url(#signova2dIdentityClip)" preserveAspectRatio="xMidYMid meet" />}
          <g className="signova2dEyes">
            <circle cx="224" cy="88" r="8" /><circle cx="276" cy="88" r="8" />
            <circle cx="224" cy="89" r="3" /><circle cx="276" cy="89" r="3" />
          </g>
          <path className="signova2dMouth" d={String(animation?.expression || '').toLowerCase().includes('smile')
            ? 'M230 119 Q250 137 270 119'
            : 'M234 122 Q250 126 266 122'} />
        </g>
      </svg>
      <span className="signova2dPoseLabel">{animation?.handshape || 'Open handshape'}</span>
    </div>
  );
}
