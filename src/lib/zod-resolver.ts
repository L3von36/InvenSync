// ============================================
// Typed zodResolver wrapper (Zod v4 + react-hook-form v7)
// ============================================
//
// In Zod v4, schemas built with `z.coerce.number()` / `z.preprocess()` have an
// INPUT type of `unknown`, while their OUTPUT (inferred via `z.infer`) is the
// concrete type (e.g. `number`). `@hookform/resolvers`' `zodResolver` is generic
// over both input and output, so passing it to `useForm<OutputType>()` produces
// a `Resolver<{ field: unknown }>` vs `Resolver<{ field: number }>` mismatch.
//
// Components type their form with the OUTPUT type (`z.infer<typeof schema>`),
// which is what the submit handler actually receives. This wrapper narrows the
// resolver to `Resolver<output>` so the call sites line up without each one
// having to spell out the three-parameter `useForm<In, Ctx, Out>` generics.

import { zodResolver as baseZodResolver } from '@hookform/resolvers/zod'
import type { FieldValues, Resolver } from 'react-hook-form'
import type { z } from 'zod'

export function zodResolver<TOutput extends FieldValues>(
  schema: z.ZodType<TOutput>,
): Resolver<TOutput> {
  return baseZodResolver(schema as never) as unknown as Resolver<TOutput>
}
