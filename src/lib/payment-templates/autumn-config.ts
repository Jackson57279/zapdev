export const autumnConfigTemplate = `
export const autumnConfig = {
  products: [
    {
      id: "free",
      name: "Free",
      description: "Starter access",
      prices: [
        {
          id: "free-monthly",
          amount: 0,
          currency: "usd",
          interval: "monthly",
        },
      ],
      features: ["basic_generations"],
    },
    {
      id: "pro",
      name: "Pro",
      description: "Pro plan with higher limits",
      prices: [
        {
          id: "pro-monthly",
          amount: 2900,
          currency: "usd",
          interval: "monthly",
        },
      ],
      features: ["basic_generations", "priority_generations"],
    },
  ],
  features: {
    basic_generations: {
      type: "metered",
      meterId: "generations",
      included: 5,
    },
    priority_generations: {
      type: "boolean",
    },
  },
  meters: {
    generations: {
      unit: "generation",
    },
  },
} as const;
`;
