import bodyParser from "body-parser";
import express from "express";
import { BASE_NODE_PORT } from "../config";
import { NodeState, Value } from "../types";
import { delay } from "../utils";

export async function node(
  nodeId: number, // the ID of the node
  N: number, // total number of nodes in the network
  F: number, // number of faulty nodes in the network
  initialValue: Value, // initial value of the node
  isFaulty: boolean, // true if the node is faulty, false otherwise
  nodesAreReady: () => boolean, // used to know if all nodes are ready to receive requests
  setNodeIsReady: (index: number) => void // this should be called when the node is started and ready to receive requests
) {
  const node = express();
  node.use(express.json());
  node.use(bodyParser.json());

  // initial state of the node
  let state: NodeState = {
    killed: false,
    x: null,
    decided: null,
    k: null,
  };
  let V: Map<number, Value[]> = new Map();
  let P: Map<number, Value[]> = new Map();

  // TODO implement this
  // this route allows retrieving the current status of the node
  node.get("/status", (req, res) => {
    if (isFaulty) {
      res.status(500).send("faulty");
    } else {
      res.status(200).send("live");
    }
  });

  // TODO implement this
  // this route allows the node to receive messages from other nodes
  node.post("/message", async (req, res) => {
    let { k, x, messageType } = req.body;
    if (!isFaulty && !state.killed) {
      if (messageType == "P") {
        if (!P.has(k)) {
          P.set(k, []);
        }
        P.get(k)!.push(x);
        let Pbis = P.get(k)!;
        if (Pbis.length >= (N-F)) {
          let a = Pbis.filter((a1) => a1 == 0).length;
          let b = Pbis.filter((a1) => a1 == 1).length;
          if (a > (N/2)) {
            x = 0;
          } else if (b > (N/2)) {
            x = 1;
          } else {
            x = Math.random() > 0.5 ? 0 : 1;
          }
          for (let i = 0; i < N; i++) {
            fetch(`http://localhost:${BASE_NODE_PORT + i}/message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ k: k, x: x, messageType: "V"}),
            });
          }
        }
      } else if (messageType == "V") {
        if (!V.has(k)) {
          V.set(k, []);
        }
        V.get(k)!.push(x);
        let Vbis = V.get(k)!;
        if (Vbis.length >= (N-F)) {
          let a = Vbis.filter((a1) => a1 == 0).length;
          let b = Vbis.filter((a1) => a1 == 1).length;
          if (a >= F + 1) {
            state.x = 0;
            state.decided = true;
          } else if (b >= F + 1) {
            state.x = 1;
            state.decided = true;
          } else {
            if (a + b > 0 && a > b) {
              state.x = 0;
            } else if (a + b > 0 && a < b) {
              state.x = 1;
            } else {
              state.x = Math.random() > 0.5 ? 0 : 1;
            }
            state.k = k + 1;
            for (let i = 0; i < N; i++) {
              fetch(`http://localhost:${BASE_NODE_PORT + i}/message`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ k: state.k, x: state.x, messageType: "P"}),
              });
            }
          }
        }
      }
    }
    res.status(200).send("Message received successfully");
  });
  // TODO implement this
  // this route is used to start the consensus algorithm
  node.get("/start", async (req, res) => {
    while (!nodesAreReady()) {
      await delay(500);
    }
    if (!isFaulty) {
      state.k = 1;
      state.x = initialValue;
      state.decided = false;
      for (let i = 0; i < N; i++) {
        fetch(`http://localhost:${BASE_NODE_PORT + i}/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ k: state.k, x: state.x, messageType: "P"}),
        });
      }
    } else {
      state.decided = null;
      state.x = null;
      state.k = null;
    }
    res.status(200).send("Consensus started successfully");
  });

  // TODO implement this
  // this route is used to stop the consensus algorithm
  node.get("/stop", async (req, res) => {
    state.killed = true;
    res.status(200).send("Consensus stopped successfully");
  });

  // TODO implement this
  // get the current state of a node
  node.get("/getState", (req, res) => {
    res.status(200).send({
      killed: state.killed,
      x: state.x,
      decided: state.decided,
      k: state.k,
    });
  });

  // start the server
  const server = node.listen(BASE_NODE_PORT + nodeId, async () => {
    console.log(
      `Node ${nodeId} is listening on port ${BASE_NODE_PORT + nodeId}`
    );

    // the node is ready
    setNodeIsReady(nodeId);
  });

  return server;
}