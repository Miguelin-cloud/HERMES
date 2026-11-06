/**
 * Canonical Differential Evolution (DE/rand/1/bin) Engine for HERMES
 * 
 * Provides derivative-free global optimization with:
 * - Latin Hypercube Sampling (LHS) population initialization
 * - Canonical differential mutation with dithered scale factor F
 * - Binomial crossover with guaranteed mutant coordinate inheritance
 * - Principled boundary reflection handling
 * - Deb's feasibility-first constraint handling rules
 * - Elitist archive tracking
 * - Controlled population size
 * - Support for 1D, 2D, 3D, and nD optimization vectors
 */

/**
 * Deterministic PRNG using Mulberry32
 * Guarantees 100% reproducible optimization trajectories across identical seeds.
 */
export class DeterministicRNG {
  private state: number;

  constructor(seed: number = 0x8675309) {
    this.state = seed >>> 0;
  }

  public next(): number {
    this.state = (this.state + 0x6D2B79F5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public nextInRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  public nextInt(min: number, maxInclusive: number): number {
    return Math.floor(min + this.next() * (maxInclusive - min + 1));
  }
}

/**
 * Reflects a coordinate back into [0, 1] if it exceeds the boundary.
 * Prevents artificial accumulation at search domain boundaries.
 */
export function reflectBoundary(val: number): number {
  if (val >= 0 && val <= 1) return val;
  let v = val;
  let safety = 0;
  while ((v < 0 || v > 1) && safety < 10) {
    safety++;
    if (v < 0) {
      v = -v;
    } else if (v > 1) {
      v = 2 - v;
    }
  }
  return Math.min(1, Math.max(0, v));
}

/**
 * Latin Hypercube Sampling (LHS) in [0, 1]^D
 * Divides each dimension into P equal intervals and ensures exactly one sample per interval,
 * distributed randomly without clustering.
 */
export function latinHypercubeSampling(
  populationSize: number,
  dimensions: number,
  rng: DeterministicRNG
): number[][] {
  const population: number[][] = Array.from({ length: populationSize }, () =>
    new Array(dimensions).fill(0)
  );

  for (let d = 0; d < dimensions; d++) {
    // Generate permutations of interval bins [0, 1, ..., P-1]
    const bins: number[] = Array.from({ length: populationSize }, (_, i) => i);
    // Fisher-Yates shuffle
    for (let i = populationSize - 1; i > 0; i--) {
      const j = rng.nextInt(0, i);
      const tmp = bins[i];
      bins[i] = bins[j];
      bins[j] = tmp;
    }

    // Place one sample within each bin with a small random jitter
    for (let i = 0; i < populationSize; i++) {
      const bin = bins[i];
      const jitter = rng.next();
      population[i][d] = (bin + jitter) / populationSize;
    }
  }

  return population;
}

export interface VariableBound {
  min: number;
  max: number;
}

export interface EvaluationResult<T = any> {
  objective: number; // Value to MAXIMIZE
  constraintViolation: number; // >= 0, where 0 is strictly feasible
  isFeasible: boolean;
  extra?: T;
}

export interface Individual<T = any> {
  normalized: number[]; // In [0, 1]^D
  physical: number[]; // In physical units
  objective: number;
  constraintViolation: number;
  isFeasible: boolean;
  extra?: T;
}

export interface DEGenerationInfo<T = any> {
  generation: number;
  evaluations: number;
  bestFeasible: Individual<T> | null;
  bestOverall: Individual<T>;
  feasibleCount: number;
  populationSize: number;
}

export interface DEOptions<T = any> {
  dimensions: number;
  bounds: VariableBound[];
  populationSize?: number;
  maxEvaluations?: number;
  maxGenerations?: number;
  F?: number; // Base mutation factor (0.5 - 0.9)
  ditherF?: boolean; // Enable generation or individual-level dithering
  CR?: number; // Binomial crossover probability (0.7 - 0.9)
  seed?: number;
  stagnationGenerations?: number;
  evaluate: (physical: number[], normalized: number[]) => Promise<EvaluationResult<T>> | EvaluationResult<T>;
  onGeneration?: (info: DEGenerationInfo<T>) => void | Promise<void>;
  shouldStop?: () => boolean;
  yieldInterval?: number; // Evaluations between UI yields
}

/**
 * Deb's Feasibility-First Selection Rule:
 * 1. Feasible solution always beats infeasible solution.
 * 2. Between two feasible solutions, higher objective wins.
 * 3. Between two infeasible solutions, lower constraint violation wins.
 */
export function isCandidateBetter(
  candidate: { objective: number; constraintViolation: number; isFeasible: boolean },
  parent: { objective: number; constraintViolation: number; isFeasible: boolean }
): boolean {
  if (candidate.isFeasible && !parent.isFeasible) return true;
  if (!candidate.isFeasible && parent.isFeasible) return false;
  if (candidate.isFeasible && parent.isFeasible) {
    return candidate.objective > parent.objective;
  }
  return candidate.constraintViolation < parent.constraintViolation;
}

/**
 * Maps normalized vector [0, 1]^D to physical bounds
 */
export function mapToPhysical(normalized: number[], bounds: VariableBound[]): number[] {
  return normalized.map((u, i) => {
    const b = bounds[i];
    if (!b || b.max <= b.min) return b ? b.min : u;
    return b.min + u * (b.max - b.min);
  });
}

/**
 * Executes Canonical Differential Evolution (DE/rand/1/bin)
 */
export async function runDifferentialEvolution<T = any>(
  options: DEOptions<T>
): Promise<{
  bestFeasible: Individual<T> | null;
  bestCandidate: Individual<T>;
  allGenerationsBest: Array<{ generation: number; objective: number; isFeasible: boolean }>;
  totalEvaluations: number;
  totalGenerations: number;
  converged: boolean;
}> {
  const {
    dimensions,
    bounds,
    maxEvaluations = 1000,
    maxGenerations = 100,
    F = 0.7,
    ditherF = true,
    CR = 0.85,
    seed = 0x8675309,
    stagnationGenerations = 30,
    evaluate,
    onGeneration,
    shouldStop,
    yieldInterval = 20
  } = options;

  const rng = new DeterministicRNG(seed);

  // If 0 active continuous dimensions (all variables fixed), evaluate once and return
  if (dimensions === 0) {
    const emptyPhys: number[] = [];
    const emptyNorm: number[] = [];
    const evalRes = await evaluate(emptyPhys, emptyNorm);
    const ind: Individual<T> = {
      normalized: emptyNorm,
      physical: emptyPhys,
      objective: evalRes.objective,
      constraintViolation: evalRes.constraintViolation,
      isFeasible: evalRes.isFeasible,
      extra: evalRes.extra
    };
    return {
      bestFeasible: evalRes.isFeasible ? ind : null,
      bestCandidate: ind,
      allGenerationsBest: [{ generation: 1, objective: evalRes.objective, isFeasible: evalRes.isFeasible }],
      totalEvaluations: 1,
      totalGenerations: 1,
      converged: true
    };
  }

  // Recommended population size: max(30, 15 * D)
  const populationSize = options.populationSize || Math.max(30, Math.min(100, 15 * dimensions));

  // Initialize population with Latin Hypercube Sampling
  const rawPopulation = latinHypercubeSampling(populationSize, dimensions, rng);
  const population: Individual<T>[] = [];

  let totalEvaluations = 0;
  let bestFeasible: Individual<T> | null = null;
  let bestOverall: Individual<T> | null = null;

  // Evaluate initial population
  for (let i = 0; i < populationSize; i++) {
    if (shouldStop && shouldStop()) break;
    const norm = rawPopulation[i];
    const phys = mapToPhysical(norm, bounds);
    const evalRes = await evaluate(phys, norm);
    totalEvaluations++;

    const ind: Individual<T> = {
      normalized: norm,
      physical: phys,
      objective: evalRes.objective,
      constraintViolation: evalRes.constraintViolation,
      isFeasible: evalRes.isFeasible,
      extra: evalRes.extra
    };

    population.push(ind);

    if (ind.isFeasible) {
      if (!bestFeasible || ind.objective > bestFeasible.objective) {
        bestFeasible = { ...ind };
      }
    }
    if (!bestOverall || isCandidateBetter(ind, bestOverall)) {
      bestOverall = { ...ind };
    }

    if (totalEvaluations % yieldInterval === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  const allGenerationsBest: Array<{ generation: number; objective: number; isFeasible: boolean }> = [];
  if (bestOverall) {
    allGenerationsBest.push({
      generation: 0,
      objective: bestFeasible ? bestFeasible.objective : bestOverall.objective,
      isFeasible: !!bestFeasible
    });
  }

  let lastBestFeasibleObjective = bestFeasible ? bestFeasible.objective : -Infinity;
  let stagnantCount = 0;
  let currentGeneration = 0;

  // Evolution loop
  while (
    totalEvaluations < maxEvaluations &&
    currentGeneration < maxGenerations &&
    (!shouldStop || !shouldStop())
  ) {
    currentGeneration++;

    // Optional generation-level dither or vector-level dithering
    const genF = ditherF ? (0.5 + 0.4 * rng.next()) : F;

    for (let i = 0; i < populationSize; i++) {
      if (totalEvaluations >= maxEvaluations) break;
      if (shouldStop && shouldStop()) break;

      // Select 3 distinct random individuals r1, r2, r3 != i
      let r1 = rng.nextInt(0, populationSize - 1);
      while (r1 === i) r1 = rng.nextInt(0, populationSize - 1);

      let r2 = rng.nextInt(0, populationSize - 1);
      while (r2 === i || r2 === r1) r2 = rng.nextInt(0, populationSize - 1);

      let r3 = rng.nextInt(0, populationSize - 1);
      while (r3 === i || r3 === r1 || r3 === r2) r3 = rng.nextInt(0, populationSize - 1);

      const target = population[i];
      const p1 = population[r1];
      const p2 = population[r2];
      const p3 = population[r3];

      // Mutation: v = x_r1 + F * (x_r2 - x_r3)
      const mutant: number[] = new Array(dimensions);
      for (let d = 0; d < dimensions; d++) {
        const rawV = p1.normalized[d] + genF * (p2.normalized[d] - p3.normalized[d]);
        mutant[d] = reflectBoundary(rawV);
      }

      // Binomial crossover: ensure at least one coordinate from mutant
      const jRand = rng.nextInt(0, dimensions - 1);
      const trialNorm: number[] = new Array(dimensions);
      for (let d = 0; d < dimensions; d++) {
        if (rng.next() < CR || d === jRand) {
          trialNorm[d] = mutant[d];
        } else {
          trialNorm[d] = target.normalized[d];
        }
      }

      const trialPhys = mapToPhysical(trialNorm, bounds);
      const evalRes = await evaluate(trialPhys, trialNorm);
      totalEvaluations++;

      const trialInd: Individual<T> = {
        normalized: trialNorm,
        physical: trialPhys,
        objective: evalRes.objective,
        constraintViolation: evalRes.constraintViolation,
        isFeasible: evalRes.isFeasible,
        extra: evalRes.extra
      };

      // Feasibility-first selection against parent target
      if (isCandidateBetter(trialInd, target)) {
        population[i] = trialInd;

        if (trialInd.isFeasible) {
          if (!bestFeasible || trialInd.objective > bestFeasible.objective) {
            bestFeasible = { ...trialInd };
          }
        }
        if (!bestOverall || isCandidateBetter(trialInd, bestOverall)) {
          bestOverall = { ...trialInd };
        }
      }

      if (totalEvaluations % yieldInterval === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    }

    // Check stagnation
    if (bestFeasible) {
      if (bestFeasible.objective > lastBestFeasibleObjective + 1e-4) {
        lastBestFeasibleObjective = bestFeasible.objective;
        stagnantCount = 0;
      } else {
        stagnantCount++;
      }
    } else {
      stagnantCount++;
    }

    allGenerationsBest.push({
      generation: currentGeneration,
      objective: bestFeasible ? bestFeasible.objective : (bestOverall ? bestOverall.objective : 0),
      isFeasible: !!bestFeasible
    });

    if (onGeneration && bestOverall) {
      const feasibleCount = population.filter(p => p.isFeasible).length;
      await onGeneration({
        generation: currentGeneration,
        evaluations: totalEvaluations,
        bestFeasible,
        bestOverall,
        feasibleCount,
        populationSize
      });
    }

    if (stagnantCount >= stagnationGenerations) {
      // Converged
      break;
    }
  }

  return {
    bestFeasible,
    bestCandidate: bestOverall || population[0],
    allGenerationsBest,
    totalEvaluations,
    totalGenerations: currentGeneration,
    converged: stagnantCount >= stagnationGenerations
  };
}

/**
 * Standard Mathematical Benchmark Functions for Testing and Verification
 */
export const BenchmarkFunctions = {
  sphere: (x: number[]): number => {
    return x.reduce((sum, xi) => sum + xi * xi, 0);
  },
  rosenbrock: (x: number[]): number => {
    let sum = 0;
    for (let i = 0; i < x.length - 1; i++) {
      sum += 100 * Math.pow(x[i + 1] - x[i] * x[i], 2) + Math.pow(1 - x[i], 2);
    }
    return sum;
  },
  rastrigin: (x: number[]): number => {
    const n = x.length;
    return 10 * n + x.reduce((sum, xi) => sum + (xi * xi - 10 * Math.cos(2 * Math.PI * xi)), 0);
  }
};
