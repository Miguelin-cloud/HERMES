import { runDifferentialEvolution, BenchmarkFunctions } from './src/lib/differentialEvolution';

async function runTests() {
  console.log('--- Testing Differential Evolution on Standard Benchmarks ---');

  // Test 1: Sphere in 3D (min at [0, 0, 0], f = 0, so maximize -f)
  const sphereBounds = [
    { min: -5.12, max: 5.12 },
    { min: -5.12, max: 5.12 },
    { min: -5.12, max: 5.12 }
  ];
  const resSphere = await runDifferentialEvolution({
    dimensions: 3,
    bounds: sphereBounds,
    populationSize: 40,
    maxEvaluations: 1500,
    evaluate: (x) => {
      const val = BenchmarkFunctions.sphere(x);
      return {
        objective: -val, // maximize -val
        constraintViolation: 0,
        isFeasible: true
      };
    }
  });

  const sphereVal = resSphere.bestFeasible ? -resSphere.bestFeasible.objective : Infinity;
  console.log(`Sphere 3D Best: ${sphereVal.toFixed(6)} (evaluations: ${resSphere.totalEvaluations})`);
  if (sphereVal > 0.05) throw new Error('Sphere test failed to converge close to 0');

  // Test 2: Rosenbrock in 2D (min at [1, 1], f = 0)
  const rosenBounds = [
    { min: -2.048, max: 2.048 },
    { min: -2.048, max: 2.048 }
  ];
  const resRosen = await runDifferentialEvolution({
    dimensions: 2,
    bounds: rosenBounds,
    populationSize: 40,
    maxEvaluations: 2000,
    evaluate: (x) => {
      const val = BenchmarkFunctions.rosenbrock(x);
      return {
        objective: -val,
        constraintViolation: 0,
        isFeasible: true
      };
    }
  });
  const rosenVal = resRosen.bestFeasible ? -resRosen.bestFeasible.objective : Infinity;
  console.log(`Rosenbrock 2D Best: ${rosenVal.toFixed(6)} at [${resRosen.bestFeasible?.physical.map(v => v.toFixed(3)).join(', ')}]`);
  if (rosenVal > 0.1) throw new Error('Rosenbrock test failed to converge');

  // Test 3: 1D dimension test (minimum of (x - 3.5)^2 on [-10, 10])
  const res1D = await runDifferentialEvolution({
    dimensions: 1,
    bounds: [{ min: -10, max: 10 }],
    populationSize: 30,
    maxEvaluations: 800,
    evaluate: (x) => {
      const val = Math.pow(x[0] - 3.5, 2);
      return {
        objective: -val,
        constraintViolation: 0,
        isFeasible: true
      };
    }
  });
  const x1D = res1D.bestFeasible?.physical[0] ?? 0;
  console.log(`1D Test Best: x = ${x1D.toFixed(4)} (target 3.5000)`);
  if (Math.abs(x1D - 3.5) > 0.01) throw new Error('1D test failed');

  // Test 4: Constraint handling test with Deb's rules
  // Maximize x + y subject to x^2 + y^2 <= 4 (boundary at sqrt(2) ≈ 1.414, max obj ≈ 2.828)
  const resConstrained = await runDifferentialEvolution({
    dimensions: 2,
    bounds: [{ min: 0, max: 5 }, { min: 0, max: 5 }],
    populationSize: 40,
    maxEvaluations: 2000,
    evaluate: (x) => {
      const [xi, yi] = x;
      const r2 = xi * xi + yi * yi;
      const cv = r2 > 4 ? (r2 - 4) / 4 : 0;
      return {
        objective: xi + yi,
        constraintViolation: cv,
        isFeasible: cv === 0
      };
    }
  });
  const constrBest = resConstrained.bestFeasible;
  console.log(`Constrained Test Best: obj = ${constrBest?.objective.toFixed(4)} at [${constrBest?.physical.map(v => v.toFixed(3)).join(', ')}] (feasible: ${constrBest?.isFeasible})`);
  if (!constrBest || constrBest.objective < 2.7) throw new Error('Constrained test failed');

  console.log('>>> All Differential Evolution benchmark tests passed successfully! <<<');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
