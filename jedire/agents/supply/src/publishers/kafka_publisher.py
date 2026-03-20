"""
Kafka Publisher
Publishes supply insights to Kafka topics
"""
import json
from typing import Optional
from datetime import datetime
from loguru import logger
from kafka import KafkaProducer
from kafka.errors import KafkaError

from ..models import SupplyAnalysis, AgentMetrics
from config.settings import settings


class KafkaPublisher:
    """Publish supply analysis results to Kafka"""
    
    def __init__(self):
        self.name = "KafkaPublisher"
        self.producer: Optional[KafkaProducer] = None
        self.enabled = settings.enable_kafka
        self.bootstrap_servers = settings.kafka_bootstrap_servers.split(',')
        self.insights_topic = settings.kafka_topic_supply_insights
        self.metrics_topic = settings.kafka_topic_agent_metrics
        self.publish_count = 0
        self.error_count = 0
    
    def connect(self):
        """Initialize Kafka producer"""
        if not self.enabled:
            logger.info("Kafka publishing disabled")
            return
        
        try:
            self.producer = KafkaProducer(
                bootstrap_servers=self.bootstrap_servers,
                value_serializer=lambda v: json.dumps(v, default=str).encode('utf-8'),
                compression_type=settings.kafka_compression_type,
                client_id=settings.kafka_client_id,
                acks='all',  # Wait for all replicas
                retries=3,
                max_in_flight_requests_per_connection=1  # Ensure ordering
            )
            logger.success(f"Connected to Kafka: {self.bootstrap_servers}")
        except Exception as e:
            logger.error(f"Failed to connect to Kafka: {e}")
            self.enabled = False
    
    async def publish_analysis(self, analysis: SupplyAnalysis) -> bool:
        """
        Publish supply analysis to Kafka
        
        Args:
            analysis: SupplyAnalysis object
            
        Returns:
            True if published successfully
        """
        if not self.enabled:
            logger.warning("Kafka disabled, skipping publish")
            return False
        
        if self.producer is None:
            self.connect()
        
        try:
            # Convert to dict
            message = analysis.model_dump(mode='json')
            
            # Add metadata
            message['published_at'] = datetime.utcnow().isoformat()
            message['publisher'] = 'supply-agent'
            
            # Publish
            future = self.producer.send(
                self.insights_topic,
                value=message,
                key=analysis.market.encode('utf-8')
            )
            
            # Wait for result
            record_metadata = future.get(timeout=10)
            
            self.publish_count += 1
            
            logger.success(
                f"Published analysis for {analysis.market} to Kafka "
                f"(topic: {record_metadata.topic}, partition: {record_metadata.partition}, "
                f"offset: {record_metadata.offset})"
            )
            
            return True
            
        except KafkaError as e:
            self.error_count += 1
            logger.error(f"Kafka publish failed: {e}")
            return False
        except Exception as e:
            self.error_count += 1
            logger.error(f"Unexpected error publishing to Kafka: {e}")
            return False
    
    async def publish_metrics(self, metrics: AgentMetrics) -> bool:
        """
        Publish agent metrics to Kafka
        
        Args:
            metrics: AgentMetrics object
            
        Returns:
            True if published successfully
        """
        if not self.enabled or self.producer is None:
            return False
        
        try:
            message = metrics.model_dump(mode='json')
            message['published_at'] = datetime.utcnow().isoformat()
            
            future = self.producer.send(
                self.metrics_topic,
                value=message
            )
            
            future.get(timeout=10)
            
            logger.debug(f"Published agent metrics to Kafka")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to publish metrics: {e}")
            return False
    
    def flush(self):
        """Flush pending messages"""
        if self.producer:
            self.producer.flush()
    
    def close(self):
        """Close Kafka producer"""
        if self.producer:
            self.producer.close()
            logger.info("Kafka producer closed")
    
    def get_stats(self) -> dict:
        """Get publisher statistics"""
        return {
            "enabled": self.enabled,
            "publishes": self.publish_count,
            "errors": self.error_count,
            "success_rate": (
                (self.publish_count / (self.publish_count + self.error_count))
                if (self.publish_count + self.error_count) > 0
                else 1.0
            )
        }
