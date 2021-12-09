SHELL = /bin/bash

.PHONY: build
build: target/release/iasql
	echo Done!

target/release/iasql:
	cargo build --release

.PHONY: clean
clean:
	git clean -ffdx

.PHONY: install
install: target/release/iasql
	cp target/release/iasql /usr/local/bin/iasql

.PHONY: version
version:
	./.version.sh $(version)
