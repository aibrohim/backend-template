import { SetMetadata } from '@nestjs/common';

import { SKIP_RESPONSE_WRAPPER } from '@core/interceptors/response-wrapper.interceptor';

export const SkipResponseWrapper = () => SetMetadata(SKIP_RESPONSE_WRAPPER, true);
