/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-no-application',
      comment: 'domain/ must not import application/ — keeps rules pure and testable without I/O',
      severity: 'error',
      from: { path: 'modules/[^/]+/domain' },
      to: { path: 'modules/[^/]+/application' },
    },
    {
      name: 'domain-no-infra',
      comment: 'domain/ must not import infra/ — keeps Prisma and adapters out of business rules',
      severity: 'error',
      from: { path: 'modules/[^/]+/domain' },
      to: { path: 'modules/[^/]+/infra' },
    },
    {
      name: 'domain-no-api',
      comment: 'domain/ must not import api/ — controllers/gateways are adapters, not rule dependencies',
      severity: 'error',
      from: { path: 'modules/[^/]+/domain' },
      to: { path: 'modules/[^/]+/api' },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default'] },
  },
};
