import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Label as ChartLabel } from 'recharts';
import { ShieldAlert, ShieldCheck, Download } from 'lucide-react';
import { SimulationResults } from '../lib/types';
import { MotorStructureResult } from '../lib/motorStructure';
import { ThemeColors } from '../lib/theme';

interface SimulationResultsPanelProps {
  results: SimulationResults;
  motorStruct: MotorStructureResult;
  isOverpressure: boolean;
  theme: 'dark' | 'light';
  themeColors?: ThemeColors;
  t: any;
  onExport: (res: SimulationResults) => void;
}

export const SimulationResultsPanel: React.FC<SimulationResultsPanelProps> = ({
  results,
  motorStruct,
  isOverpressure,
  theme,
  themeColors,
  t,
  onExport,
}) => {
  const chartData = useMemo(() => {
    if (!results || !results.t || results.t.length === 0) return [];
    const totalPoints = results.t.length;
    const stride = totalPoints > 1500 ? Math.ceil(totalPoints / 1200) : 1;
    const sampled: any[] = [];

    const buildPoint = (idx: number) => {
      const time = results.t[idx];
      const pointData: any = {
        time: Number((time || 0).toFixed(4)),
        P0_MPa: Number(Math.max(0, results.P0_MPa[idx] || 0).toFixed(3)),
        P0_gage: Number(Math.max(0, results.P0_gage[idx] || 0).toFixed(3)),
        F_N: Number(Math.max(0, results.F_N[idx] || 0).toFixed(2)),
        E_N: Number(Math.max(0, results.E_N[idx] || 0).toFixed(2)),
        mgra_total: Number((results.mgra_total[idx] || 0).toFixed(3)),
      };
      results.grains.forEach((_, gIndex) => {
        pointData[`g${gIndex}_Abc`] = Number((results.grains_Abc?.[gIndex]?.[idx] || 0).toFixed(1));
        pointData[`g${gIndex}_Abe`] = Number((results.grains_Abe?.[gIndex]?.[idx] || 0).toFixed(1));
        pointData[`g${gIndex}_Abs`] = Number((results.grains_Abs?.[gIndex]?.[idx] || 0).toFixed(1));
        pointData[`g${gIndex}_Ab`] = Number((results.grains_Ab?.[gIndex]?.[idx] || 0).toFixed(1));
      });
      return pointData;
    };

    for (let i = 0; i < totalPoints; i += stride) {
      sampled.push(buildPoint(i));
    }
    if ((totalPoints - 1) % stride !== 0) {
      sampled.push(buildPoint(totalPoints - 1));
    }

    return sampled;
  }, [results]);

  const f_nakka_max = Math.max(...results.F_N);
  const activeNakkaSteps = results.F_N.filter((_, i) => results.mgra_total[i] > 0);
  const f_nakka_avg =
    activeNakkaSteps.length > 0 ? activeNakkaSteps.reduce((sum, v) => sum + v, 0) / activeNakkaSteps.length : 0;

  const pressureColor = themeColors?.chartPressure || (theme === 'dark' ? '#f43f5e' : '#dc2626');
  const thrustColor = themeColors?.chartThrust || (theme === 'dark' ? '#38bdf8' : '#2563eb');
  const ttiColor = themeColors?.secondary || (theme === 'dark' ? '#06b6d4' : '#0284c7');

  const legendStyle = {
    display: 'inline-block',
    width: 'auto',
    right: '0px',
    backgroundColor: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '4px 8px',
    fontFamily: 'monospace',
    fontSize: '11px',
    color: 'var(--foreground)',
  };

  const tooltipStyle = {
    backgroundColor: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    fontFamily: 'monospace',
    fontSize: '12px',
    color: 'var(--foreground)',
  };

  const governingLimitLabel =
    motorStruct.governingLimit === 'bolt_shear'
      ? t.padm_limit_bolt_shear
      : motorStruct.governingLimit === 'wall_bearing'
        ? t.padm_limit_wall_bearing
        : motorStruct.governingLimit === 'net_section'
          ? t.padm_limit_net_section
          : t.padm_limit_cylinder;

  return (
    <div className="flex flex-col gap-4 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {isOverpressure ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-red-500/60 bg-red-500/12 text-red-600 dark:text-red-300 font-mono text-xs font-semibold tabular-nums">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>
              {t.overpressure_warning} ({results.summary.Pmax_MPa.toFixed(2)} MPa &gt; {t.max_admissible_p}:{' '}
              {motorStruct.maxAdmissiblePressureMPa.toFixed(2)} MPa · {governingLimitLabel})
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono text-xs font-semibold tabular-nums">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>
              {t.pressure_safe}: {results.summary.Pmax_MPa.toFixed(2)} / {motorStruct.maxAdmissiblePressureMPa.toFixed(2)} MPa (
              {((results.summary.Pmax_MPa / Math.max(1e-6, motorStruct.maxAdmissiblePressureMPa)) * 100).toFixed(0)}%) · {governingLimitLabel}
            </span>
          </div>
        )}
        <Button
          data-tour="export-csv-btn"
          onClick={() => onExport(results)}
          variant="outline"
          size="sm"
          className="bg-card h-8 px-3 border-border text-foreground hover:text-primary hover:border-primary/60 ml-auto gap-1.5 font-mono text-xs"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{t.export_csv}</span>
        </Button>
      </div>

      <div data-tour="results-summary-cards" className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-10 gap-2.5">
        <Card className="col-span-2 lg:col-span-1 bg-card border-border rounded-lg">
          <CardContent className="p-3">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider leading-tight">{t.shape} (Motor)</p>
            <h3 className="text-lg font-mono font-bold tabular-nums tracking-wider mt-1.5 leading-none text-primary">
              {results.summary.motorClass}
            </h3>
          </CardContent>
        </Card>

        <Card className="col-span-2 lg:col-span-1 bg-card border-border rounded-lg">
          <CardContent className="p-3">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider leading-tight">{t.total_impulse} (IT)</p>
            <h3 className="text-lg font-mono font-bold tabular-nums mt-1.5 leading-none text-foreground">
              {(results.summary.It_total_N_s || 0).toFixed(0)}
              <span className="text-[11px] font-mono font-normal text-muted-foreground ml-1">N·s</span>
            </h3>
          </CardContent>
        </Card>

        <Card className="col-span-2 lg:col-span-1 bg-card border-border rounded-lg">
          <CardContent className="p-3">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider leading-tight">{t.specific_impulse} (ISP)</p>
            <h3 className="text-lg font-mono font-bold tabular-nums mt-1.5 leading-none text-foreground">
              {(results.summary.Isp_total_s || 0).toFixed(1)}
              <span className="text-[11px] font-mono font-normal text-muted-foreground ml-1">s</span>
            </h3>
          </CardContent>
        </Card>

        <Card className="col-span-2 lg:col-span-1 bg-card border-border rounded-lg">
          <CardContent className="p-2.5 gap-1 flex flex-col justify-center">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider leading-none mb-1">{t.times}</p>
            <div className="flex justify-between text-[11px] font-mono tabular-nums items-center">
              <span className="text-muted-foreground">{t.burn}</span>
              <span className="font-semibold text-foreground">{(results.summary.t_quemado || 0).toFixed(3)}s</span>
            </div>
            <div className="flex justify-between text-[11px] font-mono tabular-nums items-center">
              <span className="text-muted-foreground">{t.action}</span>
              <span className="font-semibold text-foreground">{(results.summary.t_fin || 0).toFixed(3)}s</span>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`col-span-2 lg:col-span-1 bg-card rounded-lg ${
            isOverpressure ? 'border-red-500/70 bg-red-500/5' : 'border-border'
          }`}
        >
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-xs shrink-0"
                style={{ backgroundColor: isOverpressure ? '#ef4444' : pressureColor }}
              />
              <p className={`text-[10px] font-mono font-semibold uppercase tracking-wider leading-tight ${isOverpressure ? 'text-red-500' : 'text-muted-foreground'}`}>
                {t.max_p || 'Max Pressure'}
              </p>
            </div>
            <h3 className={`text-lg font-mono font-bold tabular-nums mt-1.5 leading-none ${isOverpressure ? 'text-red-500' : 'text-foreground'}`}>
              {(results.summary.Pmax_MPa || 0).toFixed(4)}
              <span className="text-[11px] font-mono font-normal text-muted-foreground ml-1">MPa</span>
            </h3>
            <p className="text-[9.5px] font-mono tabular-nums text-muted-foreground mt-1 leading-tight truncate" title={governingLimitLabel}>
              Padm: {motorStruct.maxAdmissiblePressureMPa.toFixed(2)} MPa ({governingLimitLabel})
            </p>
          </CardContent>
        </Card>

        <Card className="col-span-2 lg:col-span-1 bg-card border-border rounded-lg">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs shrink-0 opacity-80" style={{ backgroundColor: pressureColor }} />
              <p className="text-[10px] font-mono text-muted-foreground font-semibold uppercase tracking-wider leading-tight">
                {t.avg_p || 'Avg Pressure'}
              </p>
            </div>
            <h3 className="text-lg font-mono font-bold tabular-nums mt-1.5 leading-none text-foreground">
              {(results.summary.Pmed_MPa || 0).toFixed(4)}
              <span className="text-[11px] font-mono font-normal text-muted-foreground ml-1">MPa</span>
            </h3>
          </CardContent>
        </Card>

        <Card className="col-span-2 lg:col-span-1 bg-card border-border rounded-lg">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs shrink-0" style={{ backgroundColor: thrustColor }} />
              <p className="text-[10px] font-mono text-muted-foreground font-semibold uppercase tracking-wider leading-tight">
                {t.max_f} (Nakka)
              </p>
            </div>
            <h3 className="text-lg font-mono font-bold tabular-nums mt-1.5 leading-none text-foreground">
              {f_nakka_max.toFixed(0)}
              <span className="text-[11px] font-mono font-normal text-muted-foreground ml-1">N</span>
            </h3>
          </CardContent>
        </Card>

        <Card className="col-span-2 lg:col-span-1 bg-card border-border rounded-lg">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs shrink-0 opacity-80" style={{ backgroundColor: thrustColor }} />
              <p className="text-[10px] font-mono text-muted-foreground font-semibold uppercase tracking-wider leading-tight">
                {t.avg_f} (Nakka)
              </p>
            </div>
            <h3 className="text-lg font-mono font-bold tabular-nums mt-1.5 leading-none text-foreground">
              {f_nakka_avg.toFixed(0)}
              <span className="text-[11px] font-mono font-normal text-muted-foreground ml-1">N</span>
            </h3>
          </CardContent>
        </Card>

        <Card className="col-span-2 lg:col-span-1 bg-card border-border rounded-lg">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs shrink-0" style={{ backgroundColor: ttiColor }} />
              <p className="text-[10px] font-mono text-muted-foreground font-semibold uppercase tracking-wider leading-tight">
                {t.max_f} (TTI)
              </p>
            </div>
            <h3 className="text-lg font-mono font-bold tabular-nums mt-1.5 leading-none text-foreground">
              {(results.summary.Fmax_N || 0).toFixed(0)}
              <span className="text-[11px] font-mono font-normal text-muted-foreground ml-1">N</span>
            </h3>
          </CardContent>
        </Card>

        <Card className="col-span-2 lg:col-span-1 bg-card border-border rounded-lg">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs shrink-0 opacity-80" style={{ backgroundColor: ttiColor }} />
              <p className="text-[10px] font-mono text-muted-foreground font-semibold uppercase tracking-wider leading-tight">
                {t.avg_f} (TTI)
              </p>
            </div>
            <h3 className="text-lg font-mono font-bold tabular-nums mt-1.5 leading-none text-foreground">
              {(results.summary.Fmed_N || 0).toFixed(0)}
              <span className="text-[11px] font-mono font-normal text-muted-foreground ml-1">N</span>
            </h3>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1 min-h-0">
        <Card data-tour="pressure-chart-card" className="flex flex-col bg-card border-border rounded-lg overflow-hidden">
          <CardHeader className="py-2 px-3.5 border-b border-border bg-card-header text-card-header-foreground flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] font-mono font-semibold uppercase tracking-wider text-card-header-foreground flex items-center gap-2">
              <span className="w-2.5 h-1 rounded-xs shrink-0" style={{ backgroundColor: pressureColor }} />
              <span>{t.pressure_vs_time}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-4 h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 40, left: 70, bottom: 80 }}>
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="time"
                  type="number"
                  domain={[0, 'dataMax']}
                  tickCount={10}
                  tickFormatter={(value) => value.toFixed(2)}
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)', fontFamily: 'monospace' }}
                  height={60}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={{ stroke: 'var(--border)' }}
                >
                  <ChartLabel
                    value={t.axis_time}
                    position="bottom"
                    offset={0}
                    fill="var(--muted-foreground)"
                    style={{ fontSize: '11px', fontFamily: 'monospace', letterSpacing: '1.5px', fontWeight: 600, textAnchor: 'middle' }}
                  />
                </XAxis>
                <YAxis
                  domain={[0, (dataMax: number) => dataMax * 1.1]}
                  tickFormatter={(value) => value.toFixed(1)}
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)', fontFamily: 'monospace' }}
                  width={70}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={{ stroke: 'var(--border)' }}
                >
                  <ChartLabel
                    value={t.axis_pressure}
                    angle={-90}
                    position="left"
                    offset={0}
                    fill="var(--muted-foreground)"
                    style={{ fontSize: '11px', fontFamily: 'monospace', letterSpacing: '1.5px', fontWeight: 600, textAnchor: 'middle' }}
                  />
                </YAxis>
                <Tooltip formatter={(value: number) => value.toFixed(2) + ' MPa'} labelFormatter={(lbl) => 'T+ ' + Number(lbl).toFixed(3) + 's'} contentStyle={tooltipStyle} />
                <Legend verticalAlign="top" align="right" wrapperStyle={legendStyle} />
                <Line
                  type="monotone"
                  dataKey="P0_gage"
                  stroke={pressureColor}
                  dot={false}
                  strokeWidth={2.2}
                  isAnimationActive={false}
                  name={t.axis_pressure || 'Chamber Gauge Pressure (MPa)'}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card data-tour="thrust-chart-card" className="flex flex-col bg-card border-border rounded-lg overflow-hidden">
          <CardHeader className="py-2 px-3.5 border-b border-border bg-card-header text-card-header-foreground flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] font-mono font-semibold uppercase tracking-wider text-card-header-foreground flex items-center gap-2">
              <span className="w-2.5 h-1 rounded-xs shrink-0" style={{ backgroundColor: thrustColor }} />
              <span>{t.thrust_vs_time}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-4 h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 40, left: 70, bottom: 80 }}>
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="time"
                  type="number"
                  domain={[0, 'dataMax']}
                  tickCount={10}
                  tickFormatter={(value) => value.toFixed(2)}
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)', fontFamily: 'monospace' }}
                  height={60}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={{ stroke: 'var(--border)' }}
                >
                  <ChartLabel
                    value={t.axis_time}
                    position="bottom"
                    offset={0}
                    fill="var(--muted-foreground)"
                    style={{ fontSize: '11px', fontFamily: 'monospace', letterSpacing: '1.5px', fontWeight: 600, textAnchor: 'middle' }}
                  />
                </XAxis>
                <YAxis
                  domain={[0, (dataMax: number) => dataMax * 1.1]}
                  tickFormatter={(value) => value.toFixed(0)}
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)', fontFamily: 'monospace' }}
                  width={70}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={{ stroke: 'var(--border)' }}
                >
                  <ChartLabel
                    value={t.axis_thrust}
                    angle={-90}
                    position="left"
                    offset={0}
                    fill="var(--muted-foreground)"
                    style={{ fontSize: '11px', fontFamily: 'monospace', letterSpacing: '1.5px', fontWeight: 600, textAnchor: 'middle' }}
                  />
                </YAxis>
                <Tooltip formatter={(value: number) => value.toFixed(1) + ' N'} labelFormatter={(lbl) => 'T+ ' + Number(lbl).toFixed(3) + 's'} contentStyle={tooltipStyle} />
                <Legend verticalAlign="top" align="right" layout="vertical" wrapperStyle={legendStyle} />
                <Line
                  type="monotone"
                  dataKey="F_N"
                  stroke={thrustColor}
                  dot={false}
                  strokeWidth={2.2}
                  isAnimationActive={false}
                  name={t.r_nakka + ' (N)'}
                />
                <Line
                  type="monotone"
                  dataKey="E_N"
                  stroke={ttiColor}
                  dot={false}
                  strokeWidth={1.8}
                  strokeDasharray="5 3"
                  isAnimationActive={false}
                  name={t.ideal_tti + ' (N)'}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
