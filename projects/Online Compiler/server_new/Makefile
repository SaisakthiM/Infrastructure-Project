CXX      = g++
CXXFLAGS = -std=c++17 -Wall -Wextra -O2
LDFLAGS  = -lsqlite3 -lpthread
TARGET   = server

$(TARGET): main.cpp src/*.hpp
	$(CXX) $(CXXFLAGS) main.cpp -o $(TARGET) $(LDFLAGS)

clean:
	rm -f $(TARGET) users.db /tmp/code_*

.PHONY: clean
