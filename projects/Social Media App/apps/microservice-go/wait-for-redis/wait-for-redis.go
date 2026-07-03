// wait-for-redis.go
package main

import (
	"fmt"
	"net"
	"os"
	"syscall"
	"time"
)

func main() {
	// Redis host/port from environment
	host := os.Getenv("REDIS_HOST")
	if host == "" {
		host = "redis"
	}
	port := os.Getenv("REDIS_PORT")
	if port == "" {
		port = "6379"
	}
	addr := host + ":" + port

	fmt.Printf("Waiting for Redis at %s...\n", addr)
	for {
		conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
		if err == nil {
			conn.Close()
			break
		}
		time.Sleep(1 * time.Second)
	}

	fmt.Println("Redis is up! Starting microservice...")

	// Execute the main binary
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "Missing binary to execute")
		os.Exit(1)
	}
	cmd := os.Args[1]
	args := os.Args[2:]
	err := syscall.Exec(cmd, append([]string{cmd}, args...), os.Environ())
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error executing %s: %v\n", cmd, err)
		os.Exit(1)
	}
}

