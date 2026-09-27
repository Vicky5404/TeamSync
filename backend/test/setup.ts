import 'reflect-metadata';

import { Logger } from '@nestjs/common';

// Keep test output readable; assertions cover behaviour, not log lines.
Logger.overrideLogger(false);
