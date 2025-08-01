import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createId } from "~/lib/utils";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { db, schema } from "~/server/db";
import { stores } from "~/server/db/schema";
import { RouterOutputs } from "~/trpc/shared";

export const storeRouter = createTRPCRouter({
  get: publicProcedure.query(({ ctx }) => {
    const stores = ctx.db.query.stores.findMany({
      with: {
        city: true,
        lockers: true,
      },
    });
    return stores;
  }),

  getById: publicProcedure
    .input(
      z.object({
        storeId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const store = await db.query.stores.findFirst({
        where: eq(schema.stores.identifier, input.storeId),
        with: {
          city: true,
          lockers: true,
        },
      });

      return store;
    }),

  getByCity: publicProcedure
    .input(
      z.object({
        cityId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const store = await db.query.stores.findMany({
        where: eq(schema.stores.cityId, input.cityId),
        with: {
          city: true,
          lockers: true,
        },
      });

      return store;
    }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        image: z.string().min(0).max(1023),
        cityId: z.string().min(0).max(1023),
        address: z.string().min(0).max(1023),
        organizationName: z.string().min(0).max(1023),
        description: z.string().min(0).max(1023),
        serieLocker: z.string().nullable()
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const identifier = createId();
      await ctx.db.insert(schema.stores).values({
        identifier,
        name: input.name,
        image: input.image,
        cityId: input.cityId,
        address: input.address,
        organizationName: input.organizationName,
        description: input.description,
      });

      if (input.serieLocker !== null) {
        await ctx.db.insert(schema.storesLockers)
          .values({
            storeId: identifier,
            serieLocker: input.serieLocker
          });
      }

      return { identifier };
    }),
  change: publicProcedure
    .input(
      z.object({
        identifier: z.string(),
        name: z.string(),
        image: z.string().nullable().optional(),
        cityId: z.string().min(0).max(1023),
        address: z.string().min(0).max(1023).nullable(),
        organizationName: z.string().min(0).max(1023),
        description: z.string().min(0).max(1023),
        serieLockers: z.array(z.string()).nullable(),
        firstTokenUseTime: z.number()
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const a = await ctx.db.query.stores.findFirst({
        where: eq(schema.stores.identifier, input.identifier)
      });

      if (!a) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return ctx.db.transaction(async (tx) => {
        await tx
          .update(stores)
          .set({
            name: input.name,
            image: input.image,
            cityId: input.cityId,
            address: input.address,
            description: input.description,
            organizationName: input.organizationName,
            firstTokenUseTime: input.firstTokenUseTime
          })
          .where(eq(stores.identifier, input.identifier));

        if (Array.isArray(input.serieLockers)) {
          await tx.delete(schema.storesLockers)
            .where(eq(schema.storesLockers.storeId, a.identifier));
          for (const l of input.serieLockers) {
            await tx.insert(schema.storesLockers)
              .values({
                storeId: a.identifier,
                serieLocker: l,
              });
          }
        }
      });
    }),
  changeLockers: publicProcedure
    .input(
      z.object({
        identifier: z.string(),
        serieLockers: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const a = await ctx.db.query.stores.findFirst({
        where: eq(schema.stores.identifier, input.identifier)
      });

      if (!a) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      await ctx.db.transaction(async (tx) => {
        await tx.delete(schema.storesLockers)
          .where(eq(schema.storesLockers.storeId, a.identifier));
        for (const l of input.serieLockers) {
          await tx.insert(schema.storesLockers)
            .values({
              storeId: a.identifier,
              serieLocker: l,
            });
        }
      });

      return "ok"
    }),
  delete: publicProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(schema.stores)
        .where(eq(schema.stores.identifier, input.id));
    }),
});

export type Store = RouterOutputs["store"]["get"][number];
