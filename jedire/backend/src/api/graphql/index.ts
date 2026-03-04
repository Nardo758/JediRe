/**
 * GraphQL Schema and Resolvers
 * Unified API for complex queries
 */

import { gql } from 'apollo-server-express';
import { propertyResolvers } from './resolvers/property.resolvers';
import { zoningResolvers } from './resolvers/zoning.resolvers';
import { userResolvers } from './resolvers/user.resolvers';
import { marketResolvers } from './resolvers/market.resolvers';

export const typeDefs = gql`
  scalar DateTime
  scalar JSON

  type User {
    id: ID!
    email: String!
    firstName: String
    lastName: String
    avatarUrl: String
    role: String!
    emailVerified: Boolean!
    createdAt: DateTime!
    lastLoginAt: DateTime
  }

  type Property {
    id: ID!
    addressLine1: String!
    addressLine2: String
    city: String!
    stateCode: String!
    zipCode: String!
    county: String
    latitude: Float!
    longitude: Float!
    zoningCode: String
    zoningDistrict: ZoningDistrict
    lotSizeSqft: Int
    buildingSqft: Int
    yearBuilt: Int
    bedrooms: Int
    bathrooms: Float
    currentUse: String
    propertyType: String
    analyses: [PropertyAnalysis!]
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type ZoningDistrict {
    id: ID!
    municipality: String!
    stateCode: String!
    districtCode: String!
    districtName: String
    description: String
    rules: ZoningRules
  }

  type ZoningRules {
    permittedUses: [String!]
    conditionalUses: [String!]
    prohibitedUses: [String!]
    minLotSizeSqft: Int
    maxDensityUnitsPerAcre: Float
    maxCoveragePercent: Float
    frontSetbackFt: Float
    rearSetbackFt: Float
    sideSetbackFt: Float
    maxHeightFt: Float
    maxStories: Int
    parkingSpacesPerUnit: Float
  }

  type PropertyAnalysis {
    id: ID!
    propertyId: ID!
    agentType: String!
    results: JSON!
    opportunityScore: Int
    confidenceScore: Int
    status: String!
    createdAt: DateTime!
  }

  type MarketInventory {
    city: String!
    stateCode: String!
    propertyType: String
    activeListings: Int
    medianPrice: Float
    avgDaysOnMarket: Int
    absorptionRate: Float
    snapshotDate: DateTime!
  }

  type ZoningLookupResult {
    address: String!
    coordinates: Coordinates!
    municipality: String!
    zoningDistrict: ZoningDistrict
    confidence: String!
  }

  type Coordinates {
    lat: Float!
    lng: Float!
  }

  input PropertyInput {
    addressLine1: String!
    addressLine2: String
    city: String!
    stateCode: String!
    zipCode: String!
    county: String
    latitude: Float!
    longitude: Float!
    lotSizeSqft: Int
    buildingSqft: Int
    yearBuilt: Int
    bedrooms: Int
    bathrooms: Float
    currentUse: String
    propertyType: String
  }

  input PropertyFilters {
    city: String
    stateCode: String
    zipCode: String
    propertyType: String
    minLotSize: Int
    maxLotSize: Int
  }

  type Query {
    # User queries
    me: User!
    
    # Property queries
    property(id: ID!): Property
    properties(filters: PropertyFilters, limit: Int, offset: Int): [Property!]!
    propertiesNearby(lat: Float!, lng: Float!, radius: Int): [Property!]!
    
    # Zoning queries
    zoningDistrict(id: ID!): ZoningDistrict
    zoningLookup(address: String, lat: Float, lng: Float): ZoningLookupResult
    
    # Market queries
    marketInventory(city: String!, stateCode: String!, propertyType: String): [MarketInventory!]!
    marketTrends(city: String!, stateCode: String!): JSON
  }

  type Mutation {
    # Property mutations
    createProperty(input: PropertyInput!): Property!
    updateProperty(id: ID!, input: PropertyInput!): Property!
    deleteProperty(id: ID!): Boolean!
    
    # Analysis mutations
    analyzeProperty(propertyId: ID!, agentType: String!): PropertyAnalysis!
  }
`;

export const resolvers = {
  Query: {
    ...userResolvers.Query,
    ...propertyResolvers.Query,
    ...zoningResolvers.Query,
    ...marketResolvers.Query,
  },
  Mutation: {
    ...propertyResolvers.Mutation,
  },
};
