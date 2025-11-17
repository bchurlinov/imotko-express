# Folder Structure

```
project-root/
├── src/
│   ├── api/
│   │   ├── v1/
│   │   │   ├── routes/
│   │   │   │   ├── index.js
│   │   │   │   ├── auth.routes.js
│   │   │   │   ├── user.routes.js
│   │   │   │   └── product.routes.js
│   │   │   ├── controllers/
│   │   │   │   ├── auth.controller.js
│   │   │   │   ├── user.controller.js
│   │   │   │   └── product.controller.js
│   │   │   ├── middlewares/
│   │   │   │   ├── auth.middleware.js
│   │   │   │   ├── validation.middleware.js
│   │   │   │   └── errorHandler.middleware.js
│   │   │   └── validators/
│   │   │       ├── auth.validator.js
│   │   │       └── user.validator.js
│   │   └── v2/
│   │       └── ... (future API versions)
│   │
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── user.service.js
│   │   ├── email.service.js
│   │   └── payment.service.js
│   │
│   ├── repositories/
│   │   ├── user.repository.js
│   │   ├── product.repository.js
│   │   └── base.repository.js
│   │
│   ├── models/
│   │   ├── user.model.js
│   │   ├── product.model.js
│   │   └── order.model.js
│   │
│   ├── database/
│   │   ├── connection.js
│   │   ├── migrations/
│   │   ├── seeders/
│   │   └── index.js
│   │
│   ├── config/
│   │   ├── index.js
│   │   ├── database.js
│   │   ├── redis.js
│   │   ├── aws.js
│   │   └── constants.js
│   │
│   ├── utils/
│   │   ├── logger.js
│   │   ├── apiResponse.js
│   │   ├── apiError.js
│   │   ├── catchAsync.js
│   │   └── helpers.js
│   │
│   ├── events/
│   │   ├── listeners/
│   │   ├── emitters/
│   │   └── index.js
│   │
│   ├── jobs/
│   │   ├── emailQueue.job.js
│   │   └── reportGeneration.job.js
│   │
│   ├── integrations/
│   │   ├── stripe/
│   │   ├── aws/
│   │   └── sendgrid/
│   │
│   ├── types/
│   │   ├── express.d.ts
│   │   └── custom.d.ts
│   │
│   ├── app.js
│   └── server.js
│
├── tests/
│   ├── unit/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── utils/
│   ├── integration/
│   │   └── api/
│   ├── e2e/
│   └── fixtures/
│
├── scripts/
│   ├── seed.js
│   ├── migrate.js
│   └── deploy.js
│
├── docs/
│   ├── api/
│   └── architecture/
│
├── logs/
│   ├── error.log
│   └── combined.log
│
├── .env.example
├── .env
├── .gitignore
├── .eslintrc.js
├── .prettierrc
├── package.json
├── tsconfig.json (if using TypeScript)
└── README.md
```

## Key Architecture Layers
- **Routes → Controllers → Services → Repositories → Models** keeps HTTP transport, business rules, and persistence concerns decoupled.
- Place cross-cutting middleware (auth, validation, rate limiting) under `middlewares/` and reference them from routes only.
- Use `services/` to orchestrate multiple repositories or integrations before returning DTOs to controllers.
- Leverage `repositories/` for direct ORM/data access and contain Prisma logic there.

## Example Flow
```javascript
// routes/user.routes.js
const express = require('express');
const userController = require('../controllers/user.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validateUser } = require('../validators/user.validator');

const router = express.Router();

router.post('/', validateUser, userController.createUser);
router.get('/:id', authMiddleware, userController.getUser);

module.exports = router;
```
```javascript
// controllers/user.controller.js
const userService = require('../../services/user.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/apiResponse');

exports.createUser = catchAsync(async (req, res) => {
  const user = await userService.createUser(req.body);
  res.status(201).json(new ApiResponse(201, user, 'User created successfully'));
});
```
```javascript
// services/user.service.js
const userRepository = require('../repositories/user.repository');
const emailService = require('./email.service');

exports.createUser = async (userData) => {
  const user = await userRepository.create(userData);
  await emailService.sendWelcomeEmail(user.email);
  return user;
};
```

These layers support testing, scaling, and collaborative development. Adjust naming and file extensions to align with the TypeScript implementation in `src/`.
