.PHONY: build-ApiFunction

# Invoked by `sam build` (see template.yaml Metadata: BuildMethod: makefile).
# Builds the Lambda entrypoint into a "bootstrap" binary as required by the
# provided.al2023 custom runtime, and places it in $(ARTIFACTS_DIR).
build-ApiFunction:
	GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -o $(ARTIFACTS_DIR)/bootstrap ./cmd/lambda
