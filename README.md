Running the sample project
==========================

From now let's assume that you already have heroku account,
installed heroku cli and connected to the cloud.

1. Clone the sample repository: `git clone https://github.com/streamjunction/storm-wordcount.git`
2. Create heroku application from it: `heroku apps:create`
3. Register with https://streamjunction.com
4. Create a project at https://streamjunction.com . For this project 
configure 2 streams: `input` and `words`. The stream `words` must be a 
DRPC stream
5. You will need 2 URLs from your StreamJunction project: topology submit URL, 
"input" stream URL, "words" stream URL. You can obtain all these URLs
at your project page:
    - Topology Submit URL: My Projects > _Your Project_ > Security > Click URL to show the value
    - Stream URL: My Projects > Stream > Expand _Your Stream_ > Expand Keys > Click URL to show the value
6. Configure the following heroku properties: `SJ_SUBMIT_URL` - topology submit
URL, `SJ_INPUT_STREAM_URL` - "input" stream URL, `SJ_WORDS_STREAM_URL` - 
"words" stream URL
7. Set the multilang buildpack for the project: `heroku config:set BUILDPACK_URL=https://github.com/ddollar/heroku-buildpack-multi.git`
8. Submit the project to heroku: `git push heroku master`
9. Open your project page at herokuapp.com. You can use the provided
`sample.txt` to submit to the topology and then query the word counts

Anatomy of the project
======================

The project consists of 2 pieces of software:
- java storm topology that performs actual calculations and captures the state
- node application that acts as a client to the topology: submit data for
processing (count word occurences) and perform queries (get word count)

Here are the major components:

- `storm/` - the storm project
- `web/` - the node webapp
- `package.json` - the node app descriptor; it must be placed in the root 
directory so that the default node buildpack is able to find it
- `pom.xml` - the root maven build file - its only purpose to invoke the
pom.xml from the storm project; it must be placed in the root directory
so that the default java buildpack is able to find it 
- `system.properties` - here we instruct the default java buildpack to use 
JDK 1.7
- `.buildpacks` - here the node and java buildpacks are listed so that the
multilang buildpack knows what to run
- `Procfile` - this file instructs heroku to start 1 web dyno for the node
webapp

The topology itself looks pretty much like a typical Apache Storm topology
(therefore you can easily use the same code locally as well as with the
StreamJunction service). The major differences are:

- Using provided input endpoint: although you can use any spout implementation
  StreamJunction offers a convenience service that will accept app requests
  over HTTP or MQTT and stream them into the topology. The streams are the 
  entities configured in the Stream tab of the project configuration. The same 
  stream can be used by multiple toplogies: the data will be replicated for 
  every topology. To use the stream from the topology one can use the 
  provided StreamJunction SDK spout:

        topology.newStream("spout1", new OpaqueTridentSJSpout("input"));

  The name of the stream comes as the argument to the spout constructor.
  Several types of spouts are available. Consult SDK documentation for the 
  list.

- Submitting the topology for execution: instead of using standard Storm
  Submitter, StreamJunction offers a specialized version that submits
  the topology to the StreamJunction environment:

        // Configure the number of active workers
        conf.setNumWorkers(1);          
        // Configure the used streams
        Properties inputMap = new Properties();
        // This line tells the submitter that the topolgy "sample"
        // uses the streams "input" and "words"
        inputMap.setProperty("sample", "input, words");
        try {
          // Invoke StreamJunction SDK and submit the topology.
          // The submission URL is obtained from the command line
          // arguments. See below the note about how the topology
          // is being integrated with node application in the heroku
          // environment
          Submitter.submitTopology(
            new URI(args[0]), 
            // Here comes the name of the topology. It should be
            // unique within the project
            "sample", 
            // To prevent multiple submissions of the same (or older) topology
            // we pass in the topology version that we get from the 
            // version resource initialized during build time
            Submitter.getVersionFromResource("topology.version"),
        } catch (CannotSubmitTopologyException e) {
          System.err.println("Cannot submit topology: "+e.getStatusCode()+" "+e.getReason());
          System.err.write(e.getBody());
          System.err.println();
        } catch (Exception e) {
          e.printStackTrace();
          System.exit(1);
        }
    


Submitting topology
===================

The topology is being submitted when the node application is started:

    // load streamjunction node plugin and 
    // submit the topology
    require("./client.js").submit(
      "storm/target/storm/storm", "storm/target/storm.jar", 
      process.env.SJ_SUBMIT_URL, function (err) {
      if (err) {
        console.log("Cannot submit topology: "+err);
      } else {
        web.listen(port, function() {
          console.log('Web listening on port '+port);
        });
      }
    });

To submit the topology in fact the java is being executed with the
entry point at the provided jar, so it is important to have JDK installed.

To avoid multiple submission of the same topology (when node app is 
restarted or more than one dyno is launched) the topology version
is used. The topology version is generated when the jar is being assembled,
see `storm/src/main/resources/topology.version`.
