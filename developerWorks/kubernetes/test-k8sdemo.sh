#! /bin/bash

# Default port to 8001 unless specified
PORT="${1:-8001}"

# Set POD_NAME
POD_NAME=$(kubectl get pods -o go-template --template '{{range .items}}{{.metadata.name}}{{"\n"}}{{end}}')

curl http://localhost:$PORT/api/v1/proxy/namespaces/default/pods/$POD_NAME/
