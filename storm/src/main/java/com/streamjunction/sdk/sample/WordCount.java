package com.streamjunction.sdk.sample;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Map;
import java.util.Properties;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import redis.clients.jedis.Jedis;
import redis.clients.jedis.JedisPool;
import storm.trident.Stream;
import storm.trident.TridentState;
import storm.trident.TridentTopology;
import storm.trident.operation.TridentCollector;
import storm.trident.operation.builtin.Count;
import storm.trident.operation.builtin.Debug;
import storm.trident.operation.builtin.FilterNull;
import storm.trident.operation.builtin.MapGet;
import storm.trident.operation.builtin.Sum;
import storm.trident.spout.IBatchSpout;
import storm.trident.testing.FixedBatchSpout;
import storm.trident.testing.MemoryMapState;
import storm.trident.testing.Split;
import backtype.storm.Config;
import backtype.storm.ILocalDRPC;
import backtype.storm.LocalCluster;
import backtype.storm.LocalDRPC;
import backtype.storm.generated.StormTopology;
import backtype.storm.task.TopologyContext;
import backtype.storm.tuple.Fields;
import backtype.storm.tuple.Values;

import com.streamjunction.sdk.OpaqueTridentSJSpout;
import com.streamjunction.sdk.SJSpout;
import com.streamjunction.sdk.client.CannotSubmitTopologyException;
import com.streamjunction.sdk.client.Submitter;

public class WordCount 
{
	
	static final Logger logger = LoggerFactory.getLogger(WordCount.class);
	
	private static class TestRedisSpout implements IBatchSpout {
		
		private String url;
		private JedisPool jedisPool;
		private int batchSize;
		private String inputQueue;
		
		public TestRedisSpout(String url, String inputQueue, int batchSize) {
			this.url = url;
			this.inputQueue = inputQueue;
			this.batchSize = batchSize;
		}

		public void open(Map conf, TopologyContext context) {
			try {
				this.jedisPool = new JedisPool(new URI(url));
			} catch (URISyntaxException e) {
				throw new RuntimeException(e);
			}
		}

		public void emitBatch(long batchId, TridentCollector collector) {
			if (inputQueue == null) {
				throw new RuntimeException("SJ Connector is not initialized");
			}
			
			try {
				Jedis jedis = jedisPool.getResource();
				long b = 0;
				long n = 0;
				try {
					logger.info("queue.len="+jedis.llen(inputQueue));					
					for (int i=0; i<batchSize; i++) {
						long a = System.currentTimeMillis();
						String event = jedis.rpop(inputQueue);
						b += (System.currentTimeMillis()-a);
						n++;
						if (event == null) {
							break;
						} else {
							collector.emit(new Values(new Object[] { event }));
						}	
					}
					logger.info("redis.speed="+(((double)b)/n));
				} finally {
					jedisPool.returnResource(jedis);
				}
			} catch (Exception e) {
				throw new RuntimeException("getBatch failed", e);
			}
		}

		public void ack(long batchId) {
			// TODO Auto-generated method stub
			
		}

		public void close() {
		}

		public Map getComponentConfiguration() {
			return null;
		}

		public Fields getOutputFields() {
			return new Fields("event");
		}
		
	}
	
	private static StormTopology buildTopology(ILocalDRPC drpc) {
		
		TridentTopology topology = new TridentTopology();
		
		Stream s;
		
		if (drpc == null) {
			s = topology.newStream("spout1", new OpaqueTridentSJSpout("input"));
		} else {
			String redisUrl = System.getProperty("sj.test.redis");
			if (redisUrl != null) {
				s = topology.newStream("spout1",
					new TestRedisSpout(redisUrl, "queue.lukas-test.sample.input", 100));
			} else {
				FixedBatchSpout spout = new FixedBatchSpout(new Fields("event"), 3,
			               new Values("the cow jumped over the moon"),
			               new Values("the man went to the store and bought some candy"),
			               new Values("four score and seven years ago"),
			               new Values("how many apples can you eat"));
				((FixedBatchSpout)spout).setCycle(true);
				s = topology.newStream("spout1", spout);
			}
		}
		
		        
		TridentState wordCounts = s.parallelismHint(1)
               .each(new Fields("event"), new Debug())
		       .each(new Fields("event"), new Split(), new Fields("word"))
		       .groupBy(new Fields("word"))
		       .persistentAggregate(new MemoryMapState.Factory(), new Count(), new Fields("count"))                
		       .parallelismHint(6);
		
		topology.newDRPCStream("words", drpc)
		   .parallelismHint(1)
		   .each(new Fields("args"), new Debug())
	       .each(new Fields("args"), new Split(), new Fields("word"))
	       .each(new Fields("word"), new Debug())
	       .groupBy(new Fields("word"))
	       .stateQuery(wordCounts, new Fields("word"), new MapGet(), new Fields("count"))
	       .each(new Fields("count"), new FilterNull())
	       .each(new Fields("count"), new Debug())
	       .aggregate(new Fields("count"), new Sum(), new Fields("sum"))
	       .each(new Fields("sum"), new Debug());
		
		return topology.build();
	}
	
    public static void main( String[] args ) throws Exception
    {
        
    	Config conf = new Config();

    	if (System.getProperty("sj.test.redis") != null) {
    		LocalDRPC drpc = new LocalDRPC();
    		LocalCluster cluster = new LocalCluster();
    		cluster.submitTopology("sample", conf, buildTopology(drpc));
    		try {
	    		while (true) {
	    			Thread.sleep(1000);
	    			System.out.println(drpc.execute("words", "cat dog the man"));
	    		}
    		} finally {
        		cluster.shutdown();
        		drpc.shutdown();
    		}
    		
    	} else if (args == null || args.length == 0) {
    		LocalDRPC drpc = new LocalDRPC();
    		LocalCluster cluster = new LocalCluster();

    		cluster.submitTopology("sample", conf, buildTopology(drpc));

    		for (int i=0; i<10; i++) {
    			Thread.sleep(1000);
    			System.out.println(drpc.execute("words", "cat dog the man"));
    		}


    		cluster.shutdown();
    		drpc.shutdown();
    	} else {
    		conf.setNumWorkers(1);    		
    		Properties inputMap = new Properties();
    		inputMap.setProperty("sample", "input, words");
    		
    		try {
    			Submitter.submitTopology(
    					new URI(args[0]), 
    					"sample", Submitter.getVersionFromResource("topology.version"),
    					conf, inputMap, buildTopology(null));
    		} catch (CannotSubmitTopologyException e) {
    			System.err.println("Cannot submit topology: "+e.getStatusCode()+" "+e.getReason());
    			System.err.write(e.getBody());
    			System.err.println();
    		} catch (Exception e) {			
    			e.printStackTrace();
    			System.exit(1);
    		}
    	}
    	    	
    }
}
