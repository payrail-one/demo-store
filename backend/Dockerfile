FROM golang:1.24.9-alpine3.22@sha256:54619f7dc324d135c07d55ae19f84801c45c05f86cd1b3eded177ea26d240dcf AS build

WORKDIR /src
COPY backend/go.mod ./go.mod
COPY backend/cmd ./cmd
COPY backend/internal ./internal
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -trimpath -ldflags="-s -w -buildid=" -o /out/store-api ./cmd/server

FROM scratch
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /out/store-api /store-api
USER 65532:65532
EXPOSE 18082
ENTRYPOINT ["/store-api"]
