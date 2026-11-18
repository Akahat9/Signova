import React from 'react';
import { RailIcon } from './SignovaIcons';
import { formatPracticeTime, radarPolygonPoints } from '../features/progress/progressPresentation';

export default function ProgressDashboardView({
  activePanel,
  selectedProgressMetric,
  setSelectedProgressMetric,
  appProgressStats,
  formatConfidence,
  driveItems,
  progressRadarPoints,
  progressSkillMetrics,
  showAllAchievements,
  setShowAllAchievements,
  progressAchievements,
  setStatus,
}) {
  if (activePanel && activePanel !== 'drive') {
    return null;
  }

  return (
    <section className="progressDashboard" aria-label="Signova progress dashboard">
      <div className="progressHeroGrid">
        <section
          className={`overallProgressCard ${selectedProgressMetric === 'Overall Progress' ? 'activeProgressMetric' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => setSelectedProgressMetric('Overall Progress')}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedProgressMetric('Overall Progress'); }}
        >
          <div className="bigProgressRing" style={{ '--progress-angle': `${appProgressStats.goalProgress * 3.6}deg` }}>
            <strong>{appProgressStats.goalProgress}%</strong>
            <span>Completed</span>
          </div>
          <div>
            <span>Overall Progress</span>
            <strong>{appProgressStats.completedActions ? 'Real practice is being tracked.' : 'No practice data yet.'}</strong>
            <small>{appProgressStats.completedActions ? 'These numbers come from current app activity.' : 'Start camera, save signs, or upload content to build progress.'}</small>
          </div>
        </section>

        {[
          ['practice', 'Practice Time', formatPracticeTime(appProgressStats.practiceMinutes), `${appProgressStats.detectedSigns} detections`, 'blue'],
          ['select', 'Activities Done', String(appProgressStats.completedActions), `${appProgressStats.savedItems} saved items`, 'green'],
          ['progress', 'Current Streak', appProgressStats.completedActions ? '1 Session' : '0 Sessions', `${driveItems.length} uploads`, 'orange'],
          ['info', 'Avg Confidence', formatConfidence(appProgressStats.avgConfidence), `${appProgressStats.uniqueDetected} unique signs`, 'yellow'],
        ].map(([icon, label, value, delta, tone]) => (
          <section
            className={`progressStatCard ${tone} ${selectedProgressMetric === label ? 'activeProgressMetric' : ''}`}
            key={label}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedProgressMetric(label)}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedProgressMetric(label); }}
          >
            <span className="progressStatIcon3d"><RailIcon type={icon} /></span>
            <small>{label}</small>
            <strong>{value}</strong>
            <em>{delta}</em>
          </section>
        ))}
      </div>

      <div className="progressAnalyticsGrid">
        <section className="skillsOverviewCard">
          <div className="progressSectionHeader">
            <strong>Skills Overview</strong>
            <small>{selectedProgressMetric} · Built from current detections, saved items, uploads, and community signs.</small>
          </div>
          <div className="skillsContent">
            <div className="radarChart" aria-label="Skills radar chart">
              <svg viewBox="0 0 200 200" role="img" aria-label="Live skills spider chart">
                {[25, 50, 75, 100].map((value) => <polygon key={value} points={radarPolygonPoints([value, value, value, value, value, value])} className="radarGridPolygon" />)}
                {[0, 1, 2, 3, 4, 5].map((index) => {
                  const point = radarPolygonPoints([100, 100, 100, 100, 100, 100]).split(' ')[index].split(',');
                  return <line key={index} x1="100" y1="100" x2={point[0]} y2={point[1]} className="radarAxis" />;
                })}
                <polygon points={progressRadarPoints} className="radarDataPolygon" />
                {progressRadarPoints.split(' ').map((point, index) => {
                  const [x, y] = point.split(',');
                  return <circle key={progressSkillMetrics[index][0]} cx={x} cy={y} r="4" className="radarDataPoint" />;
                })}
              </svg>
              {progressSkillMetrics.map(([label], index) => (
                <em className={`radarLabel radarLabel${index + 1}`} key={label}>{label}</em>
              ))}
            </div>
            <div className="skillBars">
              {progressSkillMetrics.map(([label, value, tone]) => (
                <div className={`skillBar ${tone} ${selectedProgressMetric === label ? 'activeSkillBar' : ''}`} key={label} role="button" tabIndex={0} onClick={() => setSelectedProgressMetric(label)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedProgressMetric(label); }}>
                  <span><b>{label}</b><em>{value}%</em></span>
                  <i><strong style={{ width: `${value}%` }} /></i>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="weeklyActivityCard">
          <div className="progressSectionHeader">
            <strong>Weekly Activity</strong>
            <small>Live session activity from current Signova data.</small>
          </div>
          <div className="lineChart" aria-label="Weekly activity line chart">
            <svg viewBox="0 0 520 230" role="img" aria-label="Weekly learning activity">
              <defs>
                <linearGradient id="activityFill" x1="0" x2="0" y1="0" y2="1">
                  <stop stopColor="#2563eb" stopOpacity="0.22" />
                  <stop offset="1" stopColor="#2563eb" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[40, 80, 120, 160].map((y) => <line key={y} x1="34" x2="500" y1={y} y2={y} className="chartGrid" />)}
              <path d={`M45 ${190 - Math.min(130, appProgressStats.detectedSigns * 12)} L115 ${190 - Math.min(130, appProgressStats.savedItems * 18)} L185 ${190 - Math.min(130, appProgressStats.storedFiles * 25)} L255 ${190 - Math.min(130, appProgressStats.createdSigns * 25)} L325 ${190 - Math.min(130, Math.round(appProgressStats.avgConfidence * 100))} L395 ${190 - Math.min(130, appProgressStats.uniqueDetected * 18)} L465 ${190 - Math.min(130, appProgressStats.completedActions * 10)} L465 204 L45 204 Z`} fill="url(#activityFill)" />
              <path d={`M45 ${190 - Math.min(130, appProgressStats.detectedSigns * 12)} L115 ${190 - Math.min(130, appProgressStats.savedItems * 18)} L185 ${190 - Math.min(130, appProgressStats.storedFiles * 25)} L255 ${190 - Math.min(130, appProgressStats.createdSigns * 25)} L325 ${190 - Math.min(130, Math.round(appProgressStats.avgConfidence * 100))} L395 ${190 - Math.min(130, appProgressStats.uniqueDetected * 18)} L465 ${190 - Math.min(130, appProgressStats.completedActions * 10)}`} className="chartLine" />
              {[
                [45, 190 - Math.min(130, appProgressStats.detectedSigns * 12), 'Detect'],
                [115, 190 - Math.min(130, appProgressStats.savedItems * 18), 'Saved'],
                [185, 190 - Math.min(130, appProgressStats.storedFiles * 25), 'Files'],
                [255, 190 - Math.min(130, appProgressStats.createdSigns * 25), 'Signs'],
                [325, 190 - Math.min(130, Math.round(appProgressStats.avgConfidence * 100)), 'Conf'],
                [395, 190 - Math.min(130, appProgressStats.uniqueDetected * 18), 'Unique'],
                [465, 190 - Math.min(130, appProgressStats.completedActions * 10), 'Total'],
              ].map(([x, y, day]) => (
                <g key={day}>
                  <circle cx={x} cy={y} r="6" className="chartPoint" />
                  <text x={x} y="222" textAnchor="middle">{day}</text>
                </g>
              ))}
            </svg>
          </div>
        </section>
      </div>

      <div className="progressBottomGrid">
        <section className="achievementCard">
          <div className="progressSectionHeader inlineHeader">
            <div>
              <strong>Achievements</strong>
              <small>{appProgressStats.completedActions} real actions · {driveItems.length} practice clips saved</small>
            </div>
            <button type="button" onClick={() => setShowAllAchievements((show) => !show)}>{showAllAchievements ? 'Show Less' : 'View All'}</button>
          </div>
          <div className="achievementGrid">
            {progressAchievements.slice(0, showAllAchievements ? progressAchievements.length : 4).map(([icon, label, tone]) => (
              <button type="button" className={`achievementBadge ${tone}`} key={label} onClick={() => setStatus(`${label} achievement ${tone === 'locked' ? 'is still locked.' : 'is complete.'}`)}>
                <span>{icon}</span>
                <strong>{label}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="milestoneCard">
          <div>
            <span>Next Milestone</span>
            <strong>Complete today’s goal</strong>
            <small>{Math.max(0, appProgressStats.dailyGoal - appProgressStats.completedActions)} actions left.</small>
          </div>
          <div className="milestoneProgress">
            <span><b>{appProgressStats.completedActions} / {appProgressStats.dailyGoal}</b><em>{appProgressStats.goalProgress}%</em></span>
            <i><strong style={{ width: `${appProgressStats.goalProgress}%` }} /></i>
          </div>
          <div className="trophyArt" aria-hidden="true">🏆</div>
        </section>
      </div>
    </section>
  );
}