/**
 * useMarkerClustering Hook
 * Performance optimization for large marker sets
 */

import { useMemo, useState, useEffect } from 'react';
import Supercluster from 'supercluster';
import { LayerDataPoint } from '../types/layers';

interface ClusterPoint {
  type: 'Feature';
  properties: {
    cluster: boolean;
    point_count?: number;
    cluster_id?: number;
    dataPoint?: LayerDataPoint;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
}

interface UseMarkerClusteringProps {
  data: LayerDataPoint[];
  mapBounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  } | null;
  mapZoom: number;
  enabled: boolean;
}

export const useMarkerClustering = ({
  data,
  mapBounds,
  mapZoom,
  enabled
}: UseMarkerClusteringProps) => {
  const [clusters, setClusters] = useState<ClusterPoint[]>([]);

  // Initialize supercluster
  const supercluster = useMemo(() => {
    if (!enabled || data.length === 0) return null;

    const cluster = new Supercluster({
      radius: 75, // Cluster radius in pixels
      maxZoom: 16, // Max zoom to cluster points on
      minZoom: 0,
      minPoints: 2 // Minimum points to form a cluster
    });

    // Convert data points to GeoJSON features
    const features: ClusterPoint[] = data.map(point => ({
      type: 'Feature',
      properties: {
        cluster: false,
        dataPoint: point
      },
      geometry: {
        type: 'Point',
        coordinates: [point.lng, point.lat]
      }
    }));

    cluster.load(features);
    return cluster;
  }, [data, enabled]);

  // Update clusters when map moves or zooms
  useEffect(() => {
    if (!supercluster || !mapBounds) {
      // If clustering is disabled, return all points as individual "clusters"
      if (!enabled && data.length > 0) {
        const points: ClusterPoint[] = data.map(point => ({
          type: 'Feature',
          properties: {
            cluster: false,
            dataPoint: point
          },
          geometry: {
            type: 'Point',
            coordinates: [point.lng, point.lat]
          }
        }));
        setClusters(points);
      }
      return;
    }

    try {
      const newClusters = supercluster.getClusters(
        [mapBounds.west, mapBounds.south, mapBounds.east, mapBounds.north],
        Math.floor(mapZoom)
      );

      setClusters(newClusters as ClusterPoint[]);
    } catch (error) {
      console.error('Error calculating clusters:', error);
    }
  }, [supercluster, mapBounds, mapZoom, enabled, data]);

  // Get expansion zoom for a cluster
  const getClusterExpansionZoom = (clusterId: number): number => {
    if (!supercluster) return mapZoom + 2;
    try {
      return supercluster.getClusterExpansionZoom(clusterId);
    } catch (error) {
      console.error('Error getting expansion zoom:', error);
      return mapZoom + 2;
    }
  };

  // Get leaves (individual points) for a cluster
  const getClusterLeaves = (
    clusterId: number,
    limit: number = 100
  ): LayerDataPoint[] => {
    if (!supercluster) return [];
    try {
      const leaves = supercluster.getLeaves(clusterId, limit) as ClusterPoint[];
      return leaves
        .map(leaf => leaf.properties.dataPoint)
        .filter((point): point is LayerDataPoint => point !== undefined);
    } catch (error) {
      console.error('Error getting cluster leaves:', error);
      return [];
    }
  };

  return {
    clusters,
    getClusterExpansionZoom,
    getClusterLeaves,
    isCluster: (cluster: ClusterPoint) => cluster.properties.cluster === true,
    getClusterCount: (cluster: ClusterPoint) => cluster.properties.point_count || 0,
    getDataPoint: (cluster: ClusterPoint) => cluster.properties.dataPoint
  };
};
